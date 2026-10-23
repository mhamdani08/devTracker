package service

import (
	"context"
	"errors"
	"strings"

	"github.com/devtracker/api/internal/domain"
	"github.com/devtracker/api/internal/repository"
)

var (
	ErrTaskNotFound       = errors.New("task tidak ditemukan")
	ErrTaskTitleRequired  = errors.New("judul task (title) wajib diisi")
	ErrInvalidTaskStatus  = errors.New("status task tidak valid, harus terdaftar di general parameters (TASK_STATUS)")
	ErrInvalidPriority    = errors.New("prioritas task tidak valid, harus terdaftar di general parameters (PRIORITY)")
	ErrInvalidTaskType    = errors.New("tipe task tidak valid, harus terdaftar di general parameters (TASK_TYPE)")
	ErrBlockerNoteRequired = errors.New("catatan teknis blocker (blocker_tech_notes) wajib diisi saat status task diubah ke BLOCKED")
)

type TaskService struct {
	taskRepo      *repository.TaskRepository
	projectRepo   *repository.ProjectRepository
	parameterRepo *repository.ParameterRepository
}

func NewTaskService(taskRepo *repository.TaskRepository, projectRepo *repository.ProjectRepository, parameterRepo *repository.ParameterRepository) *TaskService {
	return &TaskService{
		taskRepo:      taskRepo,
		projectRepo:   projectRepo,
		parameterRepo: parameterRepo,
	}
}

func (s *TaskService) validateParameters(ctx context.Context, taskType, priority, taskStatus string) error {
	if s.parameterRepo == nil {
		return nil
	}

	if taskType != "" {
		param, err := s.parameterRepo.GetParameterByTypeCode(ctx, "TASK_TYPE", taskType)
		if err != nil || param == nil || !param.IsActive {
			return ErrInvalidTaskType
		}
	}

	if priority != "" {
		param, err := s.parameterRepo.GetParameterByTypeCode(ctx, "PRIORITY", priority)
		if err != nil || param == nil || !param.IsActive {
			return ErrInvalidPriority
		}
	}

	if taskStatus != "" {
		param, err := s.parameterRepo.GetParameterByTypeCode(ctx, "TASK_STATUS", taskStatus)
		if err != nil || param == nil || !param.IsActive {
			return ErrInvalidTaskStatus
		}
	}

	return nil
}

func (s *TaskService) CreateTask(ctx context.Context, projectID string, req domain.CreateTaskRequest, currentUserID string) (*domain.Task, error) {
	if strings.TrimSpace(projectID) == "" {
		return nil, errors.New("ID proyek tidak boleh kosong")
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return nil, ErrTaskTitleRequired
	}

	if req.TaskStatus == "" {
		req.TaskStatus = "BACKLOG"
	} else {
		req.TaskStatus = strings.ToUpper(strings.TrimSpace(req.TaskStatus))
	}

	if req.Priority == "" {
		req.Priority = "P3"
	} else {
		req.Priority = strings.ToUpper(strings.TrimSpace(req.Priority))
	}

	if req.TaskType == "" {
		req.TaskType = "FEATURE"
	} else {
		req.TaskType = strings.ToUpper(strings.TrimSpace(req.TaskType))
	}

	if err := s.validateParameters(ctx, req.TaskType, req.Priority, req.TaskStatus); err != nil {
		return nil, err
	}

	if req.TaskStatus == "BLOCKED" && (req.BlockerTechNotes == nil || strings.TrimSpace(*req.BlockerTechNotes) == "") {
		return nil, ErrBlockerNoteRequired
	}

	return s.taskRepo.Create(ctx, projectID, req, currentUserID)
}

func (s *TaskService) GetTaskByID(ctx context.Context, id string) (*domain.Task, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("ID task tidak boleh kosong")
	}

	task, err := s.taskRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, ErrTaskNotFound
	}
	return task, nil
}

func (s *TaskService) ListTasks(ctx context.Context, filter domain.TaskFilter) ([]domain.Task, error) {
	return s.taskRepo.List(ctx, filter)
}

func (s *TaskService) UpdateTask(ctx context.Context, id string, req domain.UpdateTaskRequest) (*domain.Task, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("ID task tidak boleh kosong")
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return nil, ErrTaskTitleRequired
	}

	req.TaskStatus = strings.ToUpper(strings.TrimSpace(req.TaskStatus))
	req.Priority = strings.ToUpper(strings.TrimSpace(req.Priority))
	req.TaskType = strings.ToUpper(strings.TrimSpace(req.TaskType))

	if err := s.validateParameters(ctx, req.TaskType, req.Priority, req.TaskStatus); err != nil {
		return nil, err
	}

	if req.TaskStatus == "BLOCKED" && (req.BlockerTechNotes == nil || strings.TrimSpace(*req.BlockerTechNotes) == "") {
		return nil, ErrBlockerNoteRequired
	}

	return s.taskRepo.Update(ctx, id, req)
}

func (s *TaskService) UpdateTaskStatus(ctx context.Context, id string, req domain.UpdateTaskStatusRequest) (*domain.Task, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("ID task tidak boleh kosong")
	}

	req.TaskStatus = strings.ToUpper(strings.TrimSpace(req.TaskStatus))
	if req.TaskStatus == "" {
		return nil, errors.New("status task tidak boleh kosong")
	}

	if err := s.validateParameters(ctx, "", "", req.TaskStatus); err != nil {
		return nil, err
	}

	if req.TaskStatus == "BLOCKED" && (req.BlockerTechNotes == nil || strings.TrimSpace(*req.BlockerTechNotes) == "") {
		return nil, ErrBlockerNoteRequired
	}

	return s.taskRepo.UpdateStatus(ctx, id, req)
}

func (s *TaskService) DeleteTask(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("ID task tidak boleh kosong")
	}
	return s.taskRepo.Delete(ctx, id)
}

func (s *TaskService) GetTaskStats(ctx context.Context, projectID string) (*domain.TaskStats, error) {
	if strings.TrimSpace(projectID) == "" {
		return nil, errors.New("ID proyek tidak boleh kosong")
	}
	return s.taskRepo.GetStats(ctx, projectID)
}
