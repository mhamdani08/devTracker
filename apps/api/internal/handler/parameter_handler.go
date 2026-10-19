package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/devtracker/api/internal/domain"
	"github.com/devtracker/api/internal/repository"
	"github.com/devtracker/api/internal/service"
)

type ParameterHandler struct {
	service *service.ParameterService
}

func NewParameterHandler(service *service.ParameterService) *ParameterHandler {
	return &ParameterHandler{service: service}
}

// List or Create: /api/v1/parameters
func (h *ParameterHandler) HandleParameters(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listParameters(w, r)
	case http.MethodPost:
		h.createParameter(w, r)
	default:
		h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
	}
}

// List Distinct Types: /api/v1/parameters/types
func (h *ParameterHandler) HandleParameterTypes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
		return
	}

	types, err := h.service.ListParameterTypes(r.Context())
	if err != nil {
		log.Printf("[API] [ParameterTypes] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat tipe parameter")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    types,
	})
}

// Operations on specific ID: /api/v1/parameters/{id}
func (h *ParameterHandler) HandleParameterByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		// Fallback for paths like /api/v1/parameters/{id}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 4 {
			id = parts[3]
		}
	}

	if id == "" {
		h.writeError(w, http.StatusBadRequest, "ID parameter wajib disertakan")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getParameterByID(w, r, id)
	case http.MethodPut, http.MethodPatch:
		h.updateParameter(w, r, id)
	case http.MethodDelete:
		h.deleteParameter(w, r, id)
	default:
		h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
	}
}

// Toggle active status: /api/v1/parameters/{id}/toggle
func (h *ParameterHandler) HandleToggleParameter(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch && r.Method != http.MethodPost {
		h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 4 {
			id = parts[3]
		}
	}

	if id == "" {
		h.writeError(w, http.StatusBadRequest, "ID parameter wajib disertakan")
		return
	}

	updated, err := h.service.ToggleActive(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrParameterNotFound) {
			h.writeError(w, http.StatusNotFound, "Parameter tidak ditemukan")
			return
		}
		log.Printf("[API] [ToggleParameter] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal mengubah status parameter")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Status parameter berhasil diubah",
		"data":    updated,
	})
}

func (h *ParameterHandler) listParameters(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	paramType := query.Get("type")
	activeOnlyStr := query.Get("active_only")
	search := query.Get("search")

	activeOnly := false
	if activeOnlyStr != "" {
		b, err := strconv.ParseBool(activeOnlyStr)
		if err == nil {
			activeOnly = b
		}
	}

	params, err := h.service.ListParameters(r.Context(), paramType, activeOnly, search)
	if err != nil {
		log.Printf("[API] [ListParameters] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat daftar parameter")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    params,
		"total":   len(params),
	})
}

func (h *ParameterHandler) getParameterByID(w http.ResponseWriter, r *http.Request, id string) {
	param, err := h.service.GetParameterByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrParameterNotFound) {
			h.writeError(w, http.StatusNotFound, "Parameter tidak ditemukan")
			return
		}
		log.Printf("[API] [GetParameterByID] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat detail parameter")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    param,
	})
}

func (h *ParameterHandler) createParameter(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateParameterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Payload request tidak valid")
		return
	}

	created, err := h.service.CreateParameter(r.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrParameterTypeRequired) ||
			errors.Is(err, service.ErrCodeRequired) ||
			errors.Is(err, service.ErrNameRequired) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if errors.Is(err, repository.ErrParameterAlreadyExists) {
			h.writeError(w, http.StatusConflict, "Kode parameter sudah ada untuk tipe tersebut")
			return
		}
		log.Printf("[API] [CreateParameter] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal membuat parameter baru")
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Parameter berhasil dibuat",
		"data":    created,
	})
}

func (h *ParameterHandler) updateParameter(w http.ResponseWriter, r *http.Request, id string) {
	var req domain.UpdateParameterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Payload request tidak valid")
		return
	}

	updated, err := h.service.UpdateParameter(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, repository.ErrParameterNotFound) {
			h.writeError(w, http.StatusNotFound, "Parameter tidak ditemukan")
			return
		}
		if errors.Is(err, service.ErrNameRequired) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("[API] [UpdateParameter] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memperbarui parameter")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Parameter berhasil diperbarui",
		"data":    updated,
	})
}

func (h *ParameterHandler) deleteParameter(w http.ResponseWriter, r *http.Request, id string) {
	err := h.service.DeleteParameter(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrParameterNotFound) {
			h.writeError(w, http.StatusNotFound, "Parameter tidak ditemukan")
			return
		}
		log.Printf("[API] [DeleteParameter] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal menghapus parameter")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Parameter berhasil dihapus",
	})
}

func (h *ParameterHandler) writeJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

func (h *ParameterHandler) writeError(w http.ResponseWriter, statusCode int, message string) {
	h.writeJSON(w, statusCode, map[string]interface{}{
		"success": false,
		"error":   message,
		"status":  statusCode,
	})
}
