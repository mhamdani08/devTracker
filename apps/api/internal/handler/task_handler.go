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

type TaskHandler struct {
	service *service.TaskService
}

func NewTaskHandler(service *service.TaskService) *TaskHandler {
	return &TaskHandler{service: service}
}

// HandleProjectTasks handles /api/v1/projects/{id}/tasks and /api/v1/projects/{id}/tasks/stats
func (h *TaskHandler) HandleProjectTasks(w http.ResponseWriter, r *http.Request, projectID string) {
	trimmed := strings.Trim(r.URL.Path, "/")
	parts := strings.Split(trimmed, "/")

	// Check if requesting /api/v1/projects/{id}/tasks/stats
	if len(parts) >= 6 && parts[5] == "stats" {
		if r.Method != http.MethodGet {
			h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
			return
		}
		stats, err := h.service.GetTaskStats(r.Context(), projectID)
		if err != nil {
			log.Printf("[API] [TaskStats] Error: %v", err)
			h.writeError(w, http.StatusInternalServerError, "Gagal memuat statistik task")
			return
		}
		h.writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    stats,
		})
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.listTasksByProject(w, r, projectID)
	case http.MethodPost:
		h.createTask(w, r, projectID)
	default:
		h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
	}
}

func (h *TaskHandler) listTasksByProject(w http.ResponseWriter, r *http.Request, projectID string) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))

	filter := domain.TaskFilter{
		ProjectID:  projectID,
		AssigneeID: q.Get("assignee_id"),
		TaskStatus: q.Get("task_status"),
		Priority:   q.Get("priority"),
		TaskType:   q.Get("task_type"),
		Search:     q.Get("search"),
		Limit:      limit,
		Offset:     offset,
	}

	tasks, err := h.service.ListTasks(r.Context(), filter)
	if err != nil {
		log.Printf("[API] [ListTasks] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat daftar task")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    tasks,
	})
}

func (h *TaskHandler) createTask(w http.ResponseWriter, r *http.Request, projectID string) {
	var req domain.CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Format JSON tidak valid")
		return
	}

	currentUserID := ""
	if claims, ok := middleware.GetClaimsFromContext(r.Context()); ok && claims != nil {
		currentUserID = claims.UserID
	}

	task, err := h.service.CreateTask(r.Context(), projectID, req, currentUserID)
	if err != nil {
		log.Printf("[API] [CreateTask] Error: %v", err)
		if errors.Is(err, service.ErrTaskTitleRequired) ||
			errors.Is(err, service.ErrInvalidTaskStatus) ||
			errors.Is(err, service.ErrInvalidPriority) ||
			errors.Is(err, service.ErrInvalidTaskType) ||
			errors.Is(err, service.ErrBlockerNoteRequired) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Task berhasil dibuat",
		"data":    task,
	})
}

// HandleTaskSubroutes processes /api/v1/tasks/{id} and /api/v1/tasks/{id}/status
func (h *TaskHandler) HandleTaskSubroutes(w http.ResponseWriter, r *http.Request) {
	trimmed := strings.Trim(r.URL.Path, "/")
	parts := strings.Split(trimmed, "/")

	// Expect parts: ["api", "v1", "tasks", "{id}", ...]
	if len(parts) < 4 {
		h.writeError(w, http.StatusBadRequest, "ID task tidak valid")
		return
	}

	taskID := parts[3]

	// Case 1: /api/v1/tasks/{id}
	if len(parts) == 4 {
		switch r.Method {
		case http.MethodGet:
			h.getTaskByID(w, r, taskID)
		case http.MethodPut, http.MethodPatch:
			h.updateTask(w, r, taskID)
		case http.MethodDelete:
			h.deleteTask(w, r, taskID)
		default:
			h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
		}
		return
	}

	// Case 2: /api/v1/tasks/{id}/status
	if len(parts) == 5 && parts[4] == "status" {
		if r.Method != http.MethodPatch && r.Method != http.MethodPut {
			h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
			return
		}
		h.updateTaskStatus(w, r, taskID)
		return
	}

	h.writeError(w, http.StatusNotFound, "Endpoint task tidak ditemukan")
}

func (h *TaskHandler) getTaskByID(w http.ResponseWriter, r *http.Request, taskID string) {
	task, err := h.service.GetTaskByID(r.Context(), taskID)
	if err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			h.writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Printf("[API] [GetTask] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal mengambil rincian task")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    task,
	})
}

func (h *TaskHandler) updateTask(w http.ResponseWriter, r *http.Request, taskID string) {
	var req domain.UpdateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Format JSON tidak valid")
		return
	}

	task, err := h.service.UpdateTask(r.Context(), taskID, req)
	if err != nil {
		log.Printf("[API] [UpdateTask] Error: %v", err)
		if errors.Is(err, service.ErrTaskNotFound) {
			h.writeError(w, http.StatusNotFound, err.Error())
			return
		}
		if errors.Is(err, service.ErrTaskTitleRequired) ||
			errors.Is(err, service.ErrInvalidTaskStatus) ||
			errors.Is(err, service.ErrInvalidPriority) ||
			errors.Is(err, service.ErrInvalidTaskType) ||
			errors.Is(err, service.ErrBlockerNoteRequired) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Task berhasil diperbarui",
		"data":    task,
	})
}

func (h *TaskHandler) updateTaskStatus(w http.ResponseWriter, r *http.Request, taskID string) {
	var req domain.UpdateTaskStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Format JSON tidak valid")
		return
	}

	task, err := h.service.UpdateTaskStatus(r.Context(), taskID, req)
	if err != nil {
		log.Printf("[API] [UpdateTaskStatus] Error: %v", err)
		if errors.Is(err, service.ErrTaskNotFound) {
			h.writeError(w, http.StatusNotFound, err.Error())
			return
		}
		if errors.Is(err, service.ErrInvalidTaskStatus) || errors.Is(err, service.ErrBlockerNoteRequired) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Status task berhasil diubah",
		"data":    task,
	})
}

func (h *TaskHandler) deleteTask(w http.ResponseWriter, r *http.Request, taskID string) {
	err := h.service.DeleteTask(r.Context(), taskID)
	if err != nil {
		log.Printf("[API] [DeleteTask] Error: %v", err)
		if errors.Is(err, service.ErrTaskNotFound) {
			h.writeError(w, http.StatusNotFound, err.Error())
			return
		}
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Task berhasil dihapus",
	})
}

func (h *TaskHandler) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (h *TaskHandler) writeError(w http.ResponseWriter, status int, message string) {
	h.writeJSON(w, status, map[string]interface{}{
		"success": false,
		"error":   message,
	})
}
