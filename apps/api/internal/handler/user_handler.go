package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/devtracker/api/internal/domain"
	"github.com/devtracker/api/internal/middleware"
	"github.com/devtracker/api/internal/service"
)

type UserHandler struct {
	userService *service.UserService
}

func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

// HandleUsers processes /api/v1/users (GET list, POST create)
func (h *UserHandler) HandleUsers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listUsers(w, r)
	case http.MethodPost:
		h.createUser(w, r)
	default:
		h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
	}
}

// HandleUserStats processes /api/v1/users/stats
func (h *UserHandler) HandleUserStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
		return
	}

	stats, err := h.userService.GetStats(r.Context())
	if err != nil {
		log.Printf("[API] [UserStats] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat statistik pengguna")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

// HandleUserSubroutes processes /api/v1/users/{id} and subroutes
func (h *UserHandler) HandleUserSubroutes(w http.ResponseWriter, r *http.Request) {
	trimmed := strings.Trim(r.URL.Path, "/")
	parts := strings.Split(trimmed, "/")

	// Expect parts: ["api", "v1", "users", "{id}", ...]
	if len(parts) < 4 {
		h.writeError(w, http.StatusBadRequest, "ID pengguna tidak valid")
		return
	}

	targetID := parts[3]
	if targetID == "stats" {
		h.HandleUserStats(w, r)
		return
	}

	// Case 1: /api/v1/users/{id}
	if len(parts) == 4 {
		switch r.Method {
		case http.MethodGet:
			h.getUserByID(w, r, targetID)
		case http.MethodPut, http.MethodPatch:
			h.updateUser(w, r, targetID)
		case http.MethodDelete:
			h.deleteUser(w, r, targetID)
		default:
			h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
		}
		return
	}

	// Case 2: /api/v1/users/{id}/status (Toggle Status)
	if len(parts) == 5 && parts[4] == "status" {
		if r.Method != http.MethodPatch && r.Method != http.MethodPut && r.Method != http.MethodPost {
			h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
			return
		}
		h.toggleUserStatus(w, r, targetID)
		return
	}

	// Case 3: /api/v1/users/{id}/password (Reset Password)
	if len(parts) == 5 && parts[4] == "password" {
		if r.Method != http.MethodPatch && r.Method != http.MethodPut && r.Method != http.MethodPost {
			h.writeError(w, http.StatusMethodNotAllowed, "Metode HTTP tidak diizinkan")
			return
		}
		h.resetPassword(w, r, targetID)
		return
	}

	h.writeError(w, http.StatusNotFound, "Endpoint pengguna tidak ditemukan")
}

func (h *UserHandler) listUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	includeInactive := q.Get("include_inactive") == "true" || q.Get("all") == "true"

	filter := domain.UserFilter{
		Search:          q.Get("search"),
		RoleID:          q.Get("role_id"),
		SystemRole:      q.Get("system_role"),
		Status:          q.Get("status"),
		IncludeInactive: includeInactive,
	}

	users, err := h.userService.ListUsers(r.Context(), filter)
	if err != nil {
		log.Printf("[API] [ListUsers] Error: %v", err)
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat daftar pengguna")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    users,
	})
}

func (h *UserHandler) getUserByID(w http.ResponseWriter, r *http.Request, id string) {
	user, err := h.userService.GetUserByID(r.Context(), id)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "Pengguna tidak ditemukan")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    user,
	})
}

func (h *UserHandler) createUser(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Format payload JSON tidak valid")
		return
	}

	user, err := h.userService.CreateUser(r.Context(), req)
	if err != nil {
		log.Printf("[API] [CreateUser] Error: %v", err)
		if errors.Is(err, service.ErrEmailAlreadyRegistered) ||
			errors.Is(err, service.ErrInvalidPasswordLength) ||
			errors.Is(err, service.ErrUserNameRequired) ||
			errors.Is(err, service.ErrInvalidEmail) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Pengguna baru berhasil ditambahkan",
		"data":    user,
	})
}

func (h *UserHandler) updateUser(w http.ResponseWriter, r *http.Request, id string) {
	var req domain.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Format payload JSON tidak valid")
		return
	}

	user, err := h.userService.UpdateUser(r.Context(), id, req)
	if err != nil {
		log.Printf("[API] [UpdateUser] Error: %v", err)
		if errors.Is(err, service.ErrEmailAlreadyRegistered) ||
			errors.Is(err, service.ErrUserNameRequired) ||
			errors.Is(err, service.ErrInvalidEmail) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Data pengguna berhasil diperbarui",
		"data":    user,
	})
}

func (h *UserHandler) toggleUserStatus(w http.ResponseWriter, r *http.Request, id string) {
	currentAdminID := ""
	if claims, ok := middleware.GetClaimsFromContext(r.Context()); ok && claims != nil {
		currentAdminID = claims.UserID
	}

	user, err := h.userService.ToggleUserStatus(r.Context(), id, currentAdminID)
	if err != nil {
		log.Printf("[API] [ToggleUserStatus] Error: %v", err)
		if errors.Is(err, service.ErrSelfModificationDenied) {
			h.writeError(w, http.StatusForbidden, err.Error())
			return
		}
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	msg := "Akun pengguna diaktifkan"
	if user.Status == domain.UserStatusDisabled {
		msg = "Akun pengguna dinonaktifkan"
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": msg,
		"data":    user,
	})
}

func (h *UserHandler) resetPassword(w http.ResponseWriter, r *http.Request, id string) {
	var req domain.ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Format payload JSON tidak valid")
		return
	}

	err := h.userService.ResetPassword(r.Context(), id, req.NewPassword)
	if err != nil {
		log.Printf("[API] [ResetPassword] Error: %v", err)
		if errors.Is(err, service.ErrInvalidPasswordLength) {
			h.writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Password pengguna berhasil direset",
	})
}

func (h *UserHandler) deleteUser(w http.ResponseWriter, r *http.Request, id string) {
	currentAdminID := ""
	if claims, ok := middleware.GetClaimsFromContext(r.Context()); ok && claims != nil {
		currentAdminID = claims.UserID
	}

	err := h.userService.DeleteUser(r.Context(), id, currentAdminID)
	if err != nil {
		log.Printf("[API] [DeleteUser] Error: %v", err)
		if errors.Is(err, service.ErrSelfModificationDenied) {
			h.writeError(w, http.StatusForbidden, err.Error())
			return
		}
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Pengguna berhasil dihapus",
	})
}

func (h *UserHandler) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (h *UserHandler) writeError(w http.ResponseWriter, status int, message string) {
	h.writeJSON(w, status, map[string]interface{}{
		"success": false,
		"error":   message,
	})
}
