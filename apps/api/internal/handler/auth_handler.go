package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/devtracker/api/internal/domain"
	"github.com/devtracker/api/internal/middleware"
	"github.com/devtracker/api/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req domain.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Format payload JSON tidak valid")
		return
	}

	res, err := h.authService.Login(r.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			h.writeError(w, http.StatusUnauthorized, "Email atau password salah")
			return
		}
		if errors.Is(err, service.ErrAccountNotActive) {
			h.writeError(w, http.StatusForbidden, "Akun Anda berstatus non-aktif atau belum diaktivasi")
			return
		}
		h.writeError(w, http.StatusInternalServerError, "Terjadi kesalahan internal server")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Login berhasil",
		"data":    res,
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, ok := middleware.GetClaimsFromContext(r.Context())
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Sesi tidak terautentikasi")
		return
	}

	profile, err := h.authService.GetProfile(r.Context(), claims.UserID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "Pengguna tidak ditemukan")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    profile,
	})
}

func (h *AuthHandler) Roles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	roles, err := h.authService.ListRoles(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat daftar role")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    roles,
	})
}

func (h *AuthHandler) Users(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	users, err := h.authService.ListUsers(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "Gagal memuat daftar pengguna")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    users,
	})
}

func (h *AuthHandler) writeJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

func (h *AuthHandler) writeError(w http.ResponseWriter, statusCode int, message string) {
	h.writeJSON(w, statusCode, map[string]interface{}{
		"success": false,
		"error":   message,
		"status":  statusCode,
	})
}
