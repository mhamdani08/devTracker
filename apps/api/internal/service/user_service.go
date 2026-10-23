package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/devtracker/api/internal/domain"
	"github.com/devtracker/api/internal/repository"
)

var (
	ErrEmailAlreadyRegistered = errors.New("email sudah terdaftar dalam sistem")
	ErrSelfModificationDenied = errors.New("tidak dapat menonaktifkan atau menghapus akun Anda sendiri")
	ErrInvalidPasswordLength = errors.New("password baru minimal harus 6 karakter")
	ErrUserNameRequired       = errors.New("nama lengkap pengguna wajib diisi")
	ErrInvalidEmail           = errors.New("format alamat email tidak valid")
)

type UserService struct {
	userRepo *repository.UserRepository
}

func NewUserService(userRepo *repository.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

func (s *UserService) ListUsers(ctx context.Context, filter domain.UserFilter) ([]domain.UserResponse, error) {
	return s.userRepo.ListUsersFiltered(ctx, filter)
}

func (s *UserService) GetUserByID(ctx context.Context, id string) (*domain.UserResponse, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("ID pengguna tidak boleh kosong")
	}
	user, err := s.userRepo.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	res := user.ToResponse()
	return &res, nil
}

func (s *UserService) CreateUser(ctx context.Context, req domain.CreateUserRequest) (*domain.UserResponse, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)

	if req.FullName == "" {
		return nil, ErrUserNameRequired
	}
	if req.Email == "" || !strings.Contains(req.Email, "@") || !strings.Contains(req.Email, ".") {
		return nil, ErrInvalidEmail
	}
	if len(req.Password) < 6 {
		return nil, ErrInvalidPasswordLength
	}

	// Check email uniqueness
	existing, err := s.userRepo.GetUserByEmail(ctx, req.Email)
	if err == nil && existing != nil {
		return nil, ErrEmailAlreadyRegistered
	}

	if req.SystemRole == "" {
		req.SystemRole = domain.SystemRoleUser
	}
	if req.Status == "" {
		req.Status = domain.UserStatusActive
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("gagal mengenkripsi password: %w", err)
	}

	return s.userRepo.CreateUser(ctx, req, string(hash))
}

func (s *UserService) UpdateUser(ctx context.Context, id string, req domain.UpdateUserRequest) (*domain.UserResponse, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("ID pengguna tidak boleh kosong")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)

	if req.FullName == "" {
		return nil, ErrUserNameRequired
	}
	if req.Email == "" || !strings.Contains(req.Email, "@") || !strings.Contains(req.Email, ".") {
		return nil, ErrInvalidEmail
	}

	// Check if email changed and taken
	existing, err := s.userRepo.GetUserByEmail(ctx, req.Email)
	if err == nil && existing != nil && existing.ID != id {
		return nil, ErrEmailAlreadyRegistered
	}

	if req.SystemRole == "" {
		req.SystemRole = domain.SystemRoleUser
	}
	if req.Status == "" {
		req.Status = domain.UserStatusActive
	}

	return s.userRepo.UpdateUser(ctx, id, req)
}

func (s *UserService) ToggleUserStatus(ctx context.Context, id string, currentAdminID string) (*domain.UserResponse, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("ID pengguna tidak boleh kosong")
	}

	if id == currentAdminID {
		return nil, ErrSelfModificationDenied
	}

	user, err := s.userRepo.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}

	newStatus := domain.UserStatusActive
	if user.Status == domain.UserStatusActive {
		newStatus = domain.UserStatusDisabled
	}

	if err := s.userRepo.UpdateUserStatus(ctx, id, newStatus); err != nil {
		return nil, err
	}

	updated, err := s.userRepo.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	res := updated.ToResponse()
	return &res, nil
}

func (s *UserService) ResetPassword(ctx context.Context, id string, newPassword string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("ID pengguna tidak boleh kosong")
	}
	if len(newPassword) < 6 {
		return ErrInvalidPasswordLength
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("gagal mengenkripsi password: %w", err)
	}

	return s.userRepo.UpdatePassword(ctx, id, string(hash))
}

func (s *UserService) DeleteUser(ctx context.Context, id string, currentAdminID string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("ID pengguna tidak boleh kosong")
	}
	if id == currentAdminID {
		return ErrSelfModificationDenied
	}
	return s.userRepo.DeleteUser(ctx, id)
}

func (s *UserService) GetStats(ctx context.Context) (*domain.UserStats, error) {
	return s.userRepo.GetStats(ctx)
}

func (s *UserService) ListRoles(ctx context.Context) ([]domain.Role, error) {
	return s.userRepo.ListRoles(ctx)
}
