package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/devtracker/api/internal/domain"
	"github.com/devtracker/api/internal/middleware"
	"github.com/devtracker/api/internal/service"
)

type ProjectHandler struct {
	service *service.ProjectService
}

func NewProjectHandler(service *service.ProjectService) *ProjectHandler {
	return &ProjectHandler{service: service}
}

// HandleProjects processes /api/v1/projects (GET list, POST create)
func (h *ProjectHandler) HandleProjects(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listProjects(w, r)
	case http.MethodPost:
		h.createProject(w, r)
	default:
		h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
	}
}

// HandleStats processes /api/v1/projects/stats
func (h *ProjectHandler) HandleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
		return
	}

	stats, err := h.service.GetStats(r.Context())
	if err != nil {
		log.Printf("[API] [ProjectStats] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat statistik proyek")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

// HandleProjectSubroutes processes /api/v1/projects/{id} and subresources
func (h *ProjectHandler) HandleProjectSubroutes(w http.ResponseWriter, r *http.Request) {
	// Parse URL path: e.g. /api/v1/projects/{id}, /api/v1/projects/{id}/members, etc.
	trimmed := strings.Trim(r.URL.Path, "/")
	parts := strings.Split(trimmed, "/")

	// Expect parts: ["api", "v1", "projects", "{id}", ...]
	if len(parts) < 4 {
		h.writeError(w, http.StatusBadRequest, "ID proyek tidak valid")
		return
	}

	projectID := parts[3]
	if projectID == "stats" {
		h.HandleStats(w, r)
		return
	}

	// Case 1: /api/v1/projects/{id}
	if len(parts) == 4 {
		switch r.Method {
		case http.MethodGet:
			h.getProjectByID(w, r, projectID)
		case http.MethodPut, http.MethodPatch:
			h.updateProject(w, r, projectID)
		case http.MethodDelete:
			h.deleteProject(w, r, projectID)
		default:
			h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
		}
		return
	}

	subResource := parts[4]

	// Case 2: /api/v1/projects/{id}/members...
	if subResource == "members" {
		if len(parts) == 5 && r.Method == http.MethodPost {
			h.addMember(w, r, projectID)
			return
		}
		if len(parts) == 6 && r.Method == http.MethodDelete {
			targetUserID := parts[5]
			h.removeMember(w, r, projectID, targetUserID)
			return
		}
	}

	// Case 3: /api/v1/projects/{id}/documents...
	if subResource == "documents" {
		if len(parts) == 5 && r.Method == http.MethodPost {
			h.addDocument(w, r, projectID)
			return
		}
		if len(parts) == 6 && r.Method == http.MethodDelete {
			docID := parts[5]
			h.removeDocument(w, r, projectID, docID)
			return
		}
	}

	h.writeError(w, http.StatusNotFound, "Endpoint tidak ditemukan")
}

// -----------------------------------------------------------------------------
// INTERNAL METHODS
// -----------------------------------------------------------------------------

func (h *ProjectHandler) listProjects(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	page, _ := strconv.Atoi(query.Get("page"))
	limit, _ := strconv.Atoi(query.Get("limit"))

	filter := domain.ProjectFilter{
		StatusProject: strings.TrimSpace(query.Get("status_project")),
		HealthStatus:  strings.TrimSpace(query.Get("health_status")),
		UnitTeam:      strings.TrimSpace(query.Get("unit_team")),
		Priority:      strings.TrimSpace(query.Get("priority")),
		Search:        strings.TrimSpace(query.Get("search")),
		Page:          page,
		Limit:         limit,
	}

	projects, total, err := h.service.ListProjects(r.Context(), filter)
	if err != nil {
		log.Printf("[API] [ListProjects] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat daftar proyek")
		return
	}

	if projects == nil {
		projects = []domain.Project{}
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    projects,
		"meta": map[string]interface{}{
			"total": total,
			"page":  filter.Page,
			"limit": filter.Limit,
		},
	})
}

func (h *ProjectHandler) getProjectByID(w http.ResponseWriter, r *http.Request, id string) {
	detail, err := h.service.GetProjectByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			h.writeError(w, http.StatusNotFound, "Proyek tidak ditemukan")
			return
		}
		log.Printf("[API] [GetProjectByID] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat detail proyek")
		return
	}

	if detail.Members == nil {
		detail.Members = []domain.ProjectMember{}
	}
	if detail.Documents == nil {
		detail.Documents = []domain.ProjectDocument{}
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    detail,
	})
}

func (h *ProjectHandler) createProject(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Payload JSON tidak valid: "+err.Error())
		return
	}

	claims, _ := middleware.GetClaimsFromContext(r.Context())
	currentUserID := ""
	if claims != nil {
		currentUserID = claims.UserID
	}

	project, err := h.service.CreateProject(r.Context(), req, currentUserID)
	if err != nil {
		if errors.Is(err, service.ErrProjectCodeExists) {
			h.writeError(w, http.StatusConflict, err.Error())
			return
		}
		if errors.Is(err, service.ErrInvalidDateRange) || errors.Is(err, service.ErrInvalidUnitTeam) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("[API] [CreateProject] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal membuat proyek: "+err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Proyek berhasil dibuat",
		"data":    project,
	})
}

func (h *ProjectHandler) updateProject(w http.ResponseWriter, r *http.Request, id string) {
	var req domain.UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Payload JSON tidak valid: "+err.Error())
		return
	}

	claims, _ := middleware.GetClaimsFromContext(r.Context())
	currentUserID := ""
	isSysAdmin := false
	if claims != nil {
		currentUserID = claims.UserID
		isSysAdmin = (claims.SystemRole == domain.SystemRoleSysAdmin)
	}

	project, err := h.service.UpdateProject(r.Context(), id, req, currentUserID, isSysAdmin)
	if err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			h.writeError(w, http.StatusNotFound, "Proyek tidak ditemukan")
			return
		}
		if errors.Is(err, service.ErrProjectCodeExists) {
			h.writeError(w, http.StatusConflict, err.Error())
			return
		}
		if errors.Is(err, service.ErrInvalidDateRange) || errors.Is(err, service.ErrInvalidUnitTeam) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("[API] [UpdateProject] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memperbarui proyek: "+err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Proyek berhasil diperbarui",
		"data":    project,
	})
}

func (h *ProjectHandler) deleteProject(w http.ResponseWriter, r *http.Request, id string) {
	claims, _ := middleware.GetClaimsFromContext(r.Context())
	currentUserID := ""
	isSysAdmin := false
	if claims != nil {
		currentUserID = claims.UserID
		isSysAdmin = (claims.SystemRole == domain.SystemRoleSysAdmin)
	}

	err := h.service.DeleteProject(r.Context(), id, currentUserID, isSysAdmin)
	if err != nil {
		if errors.Is(err, service.ErrProjectNotFound) {
			h.writeError(w, http.StatusNotFound, "Proyek tidak ditemukan")
			return
		}
		log.Printf("[API] [DeleteProject] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal menghapus proyek: "+err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Proyek berhasil dihapus",
	})
}

func (h *ProjectHandler) addMember(w http.ResponseWriter, r *http.Request, projectID string) {
	var req domain.AddProjectMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Payload JSON tidak valid")
		return
	}

	claims, _ := middleware.GetClaimsFromContext(r.Context())
	currentUserID := ""
	if claims != nil {
		currentUserID = claims.UserID
	}

	err := h.service.AddMember(r.Context(), projectID, req, currentUserID)
	if err != nil {
		if errors.Is(err, service.ErrInvalidMemberRole) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("[API] [AddMember] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal menambahkan anggota proyek: "+err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Anggota tim proyek berhasil ditambahkan",
	})
}

func (h *ProjectHandler) removeMember(w http.ResponseWriter, r *http.Request, projectID, targetUserID string) {
	err := h.service.RemoveMember(r.Context(), projectID, targetUserID)
	if err != nil {
		log.Printf("[API] [RemoveMember] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal menghapus anggota tim")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Anggota tim berhasil dihapus dari proyek",
	})
}

func (h *ProjectHandler) addDocument(w http.ResponseWriter, r *http.Request, projectID string) {
	var req domain.AddProjectDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Payload JSON tidak valid")
		return
	}

	claims, _ := middleware.GetClaimsFromContext(r.Context())
	currentUserID := ""
	if claims != nil {
		currentUserID = claims.UserID
	}

	doc, err := h.service.AddDocument(r.Context(), projectID, req, currentUserID)
	if err != nil {
		if errors.Is(err, service.ErrInvalidDocumentURL) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("[API] [AddDocument] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal menambahkan dokumen: "+err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Dokumen proyek berhasil ditambahkan",
		"data":    doc,
	})
}

func (h *ProjectHandler) removeDocument(w http.ResponseWriter, r *http.Request, projectID, docID string) {
	err := h.service.RemoveDocument(r.Context(), projectID, docID)
	if err != nil {
		log.Printf("[API] [RemoveDocument] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal menghapus dokumen")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Dokumen berhasil dihapus",
	})
}

func (h *ProjectHandler) writeJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

func (h *ProjectHandler) writeError(w http.ResponseWriter, statusCode int, message string) {
	h.writeJSON(w, statusCode, map[string]interface{}{
		"success": false,
		"error":   message,
		"status":  statusCode,
	})
}
