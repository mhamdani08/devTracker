package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/devtracker/api/internal/domain"
	"github.com/devtracker/api/internal/repository"
)

var (
	ErrInvalidCredentials = errors.New("email atau password tidak valid")
	ErrAccountNotActive   = errors.New("akun Anda berstatus non-aktif atau belum diaktivasi")
	ErrInvalidToken       = errors.New("token otorisasi tidak valid atau telah kedaluwarsa")
)

type AuthService struct {
	userRepo   *repository.UserRepository
	jwtSecret  []byte
	expHours   int
}

func NewAuthService(userRepo *repository.UserRepository, jwtSecret string, expHours int) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: []byte(jwtSecret),
		expHours:  expHours,
	}
}

func (s *AuthService) Login(ctx context.Context, req domain.LoginRequest) (*domain.LoginResponse, error) {
	email := strings.TrimSpace(req.Email)
	password := req.Password

	if email == "" || password == "" {
		return nil, ErrInvalidCredentials
	}

	user, err := s.userRepo.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if user.Status != domain.UserStatusActive {
		return nil, ErrAccountNotActive
	}

	// Verify bcrypt hash
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Update last login timestamp
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	// Create JWT token
	expiresAt := time.Now().Add(time.Duration(s.expHours) * time.Hour)
	claims := domain.JWTClaims{
		UserID:     user.ID,
		Email:      user.Email,
		FullName:   user.FullName,
		SystemRole: user.SystemRole,
		RoleCode:   user.RoleCode,
		RoleName:   user.RoleName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "devtracker-api",
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat token jwt: %w", err)
	}

	return &domain.LoginResponse{
		Token:     tokenString,
		ExpiresAt: expiresAt,
		User:      user.ToResponse(),
	}, nil
}

func (s *AuthService) VerifyToken(tokenString string) (*domain.JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &domain.JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("metode signing token tidak valid: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*domain.JWTClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

func (s *AuthService) GetProfile(ctx context.Context, userID string) (*domain.UserResponse, error) {
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	res := user.ToResponse()
	return &res, nil
}

func (s *AuthService) ListRoles(ctx context.Context) ([]domain.Role, error) {
	return s.userRepo.ListRoles(ctx)
}
