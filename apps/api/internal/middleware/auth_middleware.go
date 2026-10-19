package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/devtracker/api/internal/domain"
	"github.com/devtracker/api/internal/service"
)

type contextKey string

const ClaimsContextKey contextKey = "jwt_claims"

func AuthMiddleware(authService *service.AuthService, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeJSONError(w, http.StatusUnauthorized, "Header Authorization diperlukan")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			writeJSONError(w, http.StatusUnauthorized, "Format token harus 'Bearer <token>'")
			return
		}

		tokenString := strings.TrimSpace(parts[1])
		claims, err := authService.VerifyToken(tokenString)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, "Token otorisasi tidak valid atau telah kedaluwarsa")
			return
		}

		// Inject claims into context
		ctx := context.WithValue(r.Context(), ClaimsContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetClaimsFromContext(ctx context.Context) (*domain.JWTClaims, bool) {
	claims, ok := ctx.Value(ClaimsContextKey).(*domain.JWTClaims)
	return claims, ok
}

func RequireSysAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := GetClaimsFromContext(r.Context())
		if !ok || claims.SystemRole != domain.SystemRoleSysAdmin {
			writeJSONError(w, http.StatusForbidden, "Akses ditolak: Hanya administrator sistem (SYS_ADMIN) yang diizinkan")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSONError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"error":   message,
		"status":  statusCode,
		"success": false,
	})
}
