package service

import (
	"context"
	"errors"
	"strings"

	"github.com/devtracker/api/internal/domain"
	"github.com/devtracker/api/internal/repository"
)

var (
	ErrParameterTypeRequired = errors.New("parameter_type wajib diisi")
	ErrCodeRequired          = errors.New("code wajib diisi")
	ErrNameRequired          = errors.New("name wajib diisi")
	ErrInvalidParameterType  = errors.New("parameter_type tidak valid")
)

type ParameterService struct {
	repo *repository.ParameterRepository
}

func NewParameterService(repo *repository.ParameterRepository) *ParameterService {
	return &ParameterService{repo: repo}
}

func (s *ParameterService) ListParameters(ctx context.Context, paramType string, activeOnly bool, search string) ([]domain.GeneralParameter, error) {
	return s.repo.ListParameters(ctx, strings.TrimSpace(paramType), activeOnly, strings.TrimSpace(search))
}

func (s *ParameterService) ListParameterTypes(ctx context.Context) ([]domain.ParameterTypeSummary, error) {
	return s.repo.ListParameterTypes(ctx)
}

func (s *ParameterService) GetParameterByID(ctx context.Context, id string) (*domain.GeneralParameter, error) {
	if strings.TrimSpace(id) == "" {
		return nil, repository.ErrParameterNotFound
	}
	return s.repo.GetParameterByID(ctx, id)
}

func (s *ParameterService) CreateParameter(ctx context.Context, req domain.CreateParameterRequest) (*domain.GeneralParameter, error) {
	paramType := strings.ToUpper(strings.TrimSpace(req.ParameterType))
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	name := strings.TrimSpace(req.Name)

	if paramType == "" {
		return nil, ErrParameterTypeRequired
	}
	if code == "" {
		return nil, ErrCodeRequired
	}
	if name == "" {
		return nil, ErrNameRequired
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	param := domain.GeneralParameter{
		ParameterType: paramType,
		Code:          code,
		Name:          name,
		SortOrder:     req.SortOrder,
		IsActive:      isActive,
	}

	return s.repo.CreateParameter(ctx, param)
}

func (s *ParameterService) UpdateParameter(ctx context.Context, id string, req domain.UpdateParameterRequest) (*domain.GeneralParameter, error) {
	if strings.TrimSpace(id) == "" {
		return nil, repository.ErrParameterNotFound
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, ErrNameRequired
	}

	return s.repo.UpdateParameter(ctx, id, domain.UpdateParameterRequest{
		Name:      name,
		SortOrder: req.SortOrder,
		IsActive:  req.IsActive,
	})
}

func (s *ParameterService) ToggleActive(ctx context.Context, id string) (*domain.GeneralParameter, error) {
	if strings.TrimSpace(id) == "" {
		return nil, repository.ErrParameterNotFound
	}
	return s.repo.ToggleActive(ctx, id)
}

func (s *ParameterService) DeleteParameter(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return repository.ErrParameterNotFound
	}
	// Check if parameter exists first
	_, err := s.repo.GetParameterByID(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.DeleteParameter(ctx, id)
}
