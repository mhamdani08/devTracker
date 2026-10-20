package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/devtracker/api/internal/domain"
	"github.com/devtracker/api/internal/repository"
)

var (
	ErrProjectNotFound     = errors.New("proyek tidak ditemukan")
	ErrProjectCodeExists   = errors.New("kode proyek sudah digunakan, silakan gunakan kode lain")
	ErrInvalidDateRange    = errors.New("tanggal mulai tidak boleh melebihi target tanggal selesai")
	ErrInvalidUnitTeam     = errors.New("unit tim harus salah satu dari: Core, Non Core, All")
	ErrInvalidMemberRole   = errors.New("peran anggota harus salah satu dari: OWNER, PROJECT_MANAGER, DEVELOPER, VIEWER")
	ErrInvalidDocumentURL  = errors.New("tautan dokumen (file_url) tidak valid, harus diawali dengan http:// atau https://")
	ErrUnauthorizedProject = errors.New("anda tidak memiliki izin untuk mengelola proyek ini")
)

type ProjectService struct {
	projectRepo   *repository.ProjectRepository
	parameterRepo *repository.ParameterRepository
}

func NewProjectService(projectRepo *repository.ProjectRepository, parameterRepo *repository.ParameterRepository) *ProjectService {
	return &ProjectService{
		projectRepo:   projectRepo,
		parameterRepo: parameterRepo,
	}
}

func (s *ProjectService) ListProjects(ctx context.Context, filter domain.ProjectFilter) ([]domain.Project, int, error) {
	return s.projectRepo.List(ctx, filter)
}

func (s *ProjectService) GetProjectByID(ctx context.Context, id string) (*domain.ProjectDetail, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("ID proyek tidak boleh kosong")
	}

	detail, err := s.projectRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if detail == nil {
		return nil, ErrProjectNotFound
	}
	return detail, nil
}

func (s *ProjectService) GetStats(ctx context.Context) (*domain.ProjectStats, error) {
	return s.projectRepo.GetStats(ctx)
}

func (s *ProjectService) CreateProject(ctx context.Context, req domain.CreateProjectRequest, currentUserID string) (*domain.Project, error) {
	code := strings.ToUpper(strings.TrimSpace(req.ProjectCode))
	if code == "" {
		return nil, errors.New("kode proyek wajib diisi (contoh: PRJ-2026-001)")
	}

	name := strings.TrimSpace(req.ProjectName)
	if name == "" {
		return nil, errors.New("nama proyek wajib diisi")
	}

	// 1. Check uniqueness of code
	exists, err := s.projectRepo.CheckProjectCodeExists(ctx, code, "")
	if err != nil {
		return nil, fmt.Errorf("gagal memvalidasi kode proyek: %w", err)
	}
	if exists {
		return nil, ErrProjectCodeExists
	}

	// 2. Validate dates
	startDate := strings.TrimSpace(req.StartDate)
	if startDate == "" {
		startDate = time.Now().Format("2006-01-02")
	}
	targetDate := strings.TrimSpace(req.TargetDate)
	if targetDate == "" {
		targetDate = time.Now().AddDate(0, 1, 0).Format("2006-01-02")
	}

	t1, err1 := time.Parse("2006-01-02", startDate)
	t2, err2 := time.Parse("2006-01-02", targetDate)
	if err1 == nil && err2 == nil && t1.After(t2) {
		return nil, ErrInvalidDateRange
	}

	// 3. Validate Unit Team
	unitTeam := strings.TrimSpace(req.UnitTeam)
	if unitTeam == "" {
		unitTeam = "Core"
	}
	if unitTeam != "Core" && unitTeam != "Non Core" && unitTeam != "All" {
		return nil, ErrInvalidUnitTeam
	}

	// 4. Defaults
	status := strings.ToUpper(strings.TrimSpace(req.StatusProject))
	if status == "" {
		status = "INITIATE"
	}
	sourceType := strings.ToUpper(strings.TrimSpace(req.SourceType))
	if sourceType == "" {
		sourceType = "INTERNAL"
	}

	var picUserID *string
	if req.PICUserID != nil {
		clean := strings.TrimSpace(*req.PICUserID)
		if clean != "" && len(clean) >= 32 {
			picUserID = &clean
		}
	}

	project := &domain.Project{
		ProjectCode:      code,
		ProjectName:      name,
		PICUserID:        picUserID,
		StatusProject:    status,
		SourceType:       sourceType,
		StartDate:        startDate,
		TargetDate:       targetDate,
		RealLiveDate:     req.RealLiveDate,
		UnitTeam:         unitTeam,
		ProjectPriority:  req.ProjectPriority,
		Repository:       req.Repository,
		ActiveBlockers:   req.ActiveBlockers,
		HealthStatus:     req.HealthStatus,
		KeyRiskNotes:     req.KeyRiskNotes,
		EstimatedMandays: req.EstimatedMandays,
		ActualMandays:    req.ActualMandays,
	}

	if err := s.projectRepo.Create(ctx, project); err != nil {
		return nil, fmt.Errorf("gagal membuat proyek: %w", err)
	}

	// 5. Automatically add current user as OWNER member
	if currentUserID != "" {
		_ = s.projectRepo.AddMember(ctx, &domain.ProjectMember{
			ProjectID: project.ID,
			UserID:    currentUserID,
			Role:      string(domain.ProjectMemberRoleOwner),
		})
	}

	return project, nil
}

func (s *ProjectService) UpdateProject(ctx context.Context, id string, req domain.UpdateProjectRequest, currentUserID string, isSysAdmin bool) (*domain.Project, error) {
	existing, err := s.projectRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, ErrProjectNotFound
	}

	code := strings.ToUpper(strings.TrimSpace(req.ProjectCode))
	if code == "" {
		code = existing.ProjectCode
	}

	// Check code uniqueness if changed
	if !strings.EqualFold(code, existing.ProjectCode) {
		exists, err := s.projectRepo.CheckProjectCodeExists(ctx, code, id)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrProjectCodeExists
		}
	}

	name := strings.TrimSpace(req.ProjectName)
	if name == "" {
		name = existing.ProjectName
	}

	// Validate dates
	startDate := strings.TrimSpace(req.StartDate)
	if startDate == "" {
		startDate = existing.StartDate
	}
	targetDate := strings.TrimSpace(req.TargetDate)
	if targetDate == "" {
		targetDate = existing.TargetDate
	}
	t1, err1 := time.Parse("2006-01-02", startDate)
	t2, err2 := time.Parse("2006-01-02", targetDate)
	if err1 == nil && err2 == nil && t1.After(t2) {
		return nil, ErrInvalidDateRange
	}

	unitTeam := strings.TrimSpace(req.UnitTeam)
	if unitTeam == "" {
		unitTeam = existing.UnitTeam
	}
	if unitTeam != "Core" && unitTeam != "Non Core" && unitTeam != "All" {
		return nil, ErrInvalidUnitTeam
	}

	status := strings.ToUpper(strings.TrimSpace(req.StatusProject))
	if status == "" {
		status = existing.StatusProject
	}
	sourceType := strings.ToUpper(strings.TrimSpace(req.SourceType))
	if sourceType == "" {
		sourceType = existing.SourceType
	}

	var picUserID *string
	if req.PICUserID != nil {
		clean := strings.TrimSpace(*req.PICUserID)
		if clean != "" && len(clean) >= 32 {
			picUserID = &clean
		}
	}

	p := &domain.Project{
		ID:               id,
		ProjectCode:      code,
		ProjectName:      name,
		PICUserID:        picUserID,
		StatusProject:    status,
		SourceType:       sourceType,
		StartDate:        startDate,
		TargetDate:       targetDate,
		RealLiveDate:     req.RealLiveDate,
		UnitTeam:         unitTeam,
		ProjectPriority:  req.ProjectPriority,
		Repository:       req.Repository,
		ActiveBlockers:   req.ActiveBlockers,
		HealthStatus:     req.HealthStatus,
		KeyRiskNotes:     req.KeyRiskNotes,
		EstimatedMandays: req.EstimatedMandays,
		ActualMandays:    req.ActualMandays,
	}

	if err := s.projectRepo.Update(ctx, p); err != nil {
		return nil, fmt.Errorf("gagal memperbarui proyek: %w", err)
	}

	return p, nil
}

func (s *ProjectService) DeleteProject(ctx context.Context, id string, currentUserID string, isSysAdmin bool) error {
	existing, err := s.projectRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return ErrProjectNotFound
	}

	return s.projectRepo.Delete(ctx, id)
}

// =========================================================================
// MEMBERS SERVICE
// =========================================================================

func (s *ProjectService) AddMember(ctx context.Context, projectID string, req domain.AddProjectMemberRequest, currentUserID string) error {
	userID := strings.TrimSpace(req.UserID)
	if userID == "" {
		return errors.New("ID pengguna wajib dipilih")
	}

	role := strings.ToUpper(strings.TrimSpace(req.Role))
	if role != "OWNER" && role != "PROJECT_MANAGER" && role != "DEVELOPER" && role != "VIEWER" {
		return ErrInvalidMemberRole
	}

	member := &domain.ProjectMember{
		ProjectID: projectID,
		UserID:    userID,
		Role:      role,
		InvitedBy: &currentUserID,
	}

	return s.projectRepo.AddMember(ctx, member)
}

func (s *ProjectService) RemoveMember(ctx context.Context, projectID, targetUserID string) error {
	return s.projectRepo.RemoveMember(ctx, projectID, targetUserID)
}

// =========================================================================
// DOCUMENTS SERVICE
// =========================================================================

func (s *ProjectService) AddDocument(ctx context.Context, projectID string, req domain.AddProjectDocumentRequest, currentUserID string) (*domain.ProjectDocument, error) {
	name := strings.TrimSpace(req.DocName)
	if name == "" {
		return nil, errors.New("nama dokumen wajib diisi")
	}

	rawURL := strings.TrimSpace(req.FileURL)
	if rawURL == "" {
		return nil, errors.New("tautan file (file_url) wajib diisi")
	}

	u, err := url.ParseRequestURI(rawURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, ErrInvalidDocumentURL
	}

	docType := strings.ToUpper(strings.TrimSpace(req.DocType))
	if docType == "" {
		docType = "LAINNYA"
	}

	storageType := strings.ToUpper(strings.TrimSpace(req.StorageType))
	if storageType == "" {
		storageType = "EXTERNAL_LINK"
	}

	var upBy *string
	if currentUserID != "" {
		upBy = &currentUserID
	}

	doc := &domain.ProjectDocument{
		ProjectID:     projectID,
		DocName:       name,
		DocType:       &docType,
		FileURL:       rawURL,
		StorageType:   storageType,
		FileSizeBytes: req.FileSizeBytes,
		UploadedBy:    upBy,
	}

	if err := s.projectRepo.AddDocument(ctx, doc); err != nil {
		return nil, fmt.Errorf("gagal menambahkan dokumen: %w", err)
	}

	return doc, nil
}

func (s *ProjectService) RemoveDocument(ctx context.Context, projectID, docID string) error {
	return s.projectRepo.RemoveDocument(ctx, projectID, docID)
}
