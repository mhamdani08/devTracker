package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/devtracker/api/internal/domain"
)

type TaskRepository struct {
	db *sql.DB
}

func NewTaskRepository(db *sql.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

// Create inserts a new task within a transaction, atomically generating the project-scoped task_code
func (r *TaskRepository) Create(ctx context.Context, projectID string, req domain.CreateTaskRequest, currentUserID string) (*domain.Task, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Atomically increment last_task_number on projects and retrieve project_code
	var projectCode string
	var nextNum int
	err = tx.QueryRowContext(ctx, `
		UPDATE projects
		SET last_task_number = last_task_number + 1,
		    updated_at = now()
		WHERE id = $1
		RETURNING project_code, last_task_number
	`, projectID).Scan(&projectCode, &nextNum)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("proyek tidak ditemukan")
		}
		return nil, fmt.Errorf("failed to increment project task counter: %w", err)
	}

	taskCode := fmt.Sprintf("%s-T%02d", projectCode, nextNum)

	// 2. Determine sort order if not explicitly passed
	sortOrder := req.SortOrder
	if sortOrder <= 0 {
		var maxOrder sql.NullInt64
		_ = tx.QueryRowContext(ctx, `
			SELECT MAX(sort_order) FROM tasks 
			WHERE project_id = $1 AND task_status = $2
		`, projectID, req.TaskStatus).Scan(&maxOrder)
		if maxOrder.Valid {
			sortOrder = int(maxOrder.Int64) + 1
		} else {
			sortOrder = 1
		}
	}

	var completedAt *time.Time
	if strings.ToUpper(req.TaskStatus) == "DONE" {
		now := time.Now()
		completedAt = &now
	}

	// 3. Insert task
	insertQuery := `
		INSERT INTO tasks (
			project_id, task_code, title, description, task_type, priority, task_status,
			assignee_id, created_by, branch_pr_link, target_due, completed_at,
			est_hours, actual_hours, blocker_tech_notes, sort_order
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		)
		RETURNING id, created_at, updated_at
	`

	var targetDueVal interface{}
	if req.TargetDue != nil && strings.TrimSpace(*req.TargetDue) != "" {
		targetDueVal = *req.TargetDue
	}

	var createdByVal interface{}
	if strings.TrimSpace(currentUserID) != "" {
		createdByVal = currentUserID
	}

	var taskID string
	var createdAt, updatedAt time.Time

	err = tx.QueryRowContext(ctx, insertQuery,
		projectID,
		taskCode,
		strings.TrimSpace(req.Title),
		req.Description,
		strings.ToUpper(strings.TrimSpace(req.TaskType)),
		strings.ToUpper(strings.TrimSpace(req.Priority)),
		strings.ToUpper(strings.TrimSpace(req.TaskStatus)),
		req.AssigneeID,
		createdByVal,
		req.BranchPRLink,
		targetDueVal,
		completedAt,
		req.EstHours,
		req.ActualHours,
		req.BlockerTechNotes,
		sortOrder,
	).Scan(&taskID, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert task: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit task transaction: %w", err)
	}

	return r.GetByID(ctx, taskID)
}

// GetByID retrieves a task with all joined relations (assignee, creator, parameter names, project info)
func (r *TaskRepository) GetByID(ctx context.Context, id string) (*domain.Task, error) {
	query := `
		SELECT 
			t.id, t.project_id, p.project_code, p.project_name,
			t.task_code, t.title, t.description,
			t.task_type, COALESCE(gp_type.name, t.task_type) as task_type_name,
			t.priority, COALESCE(gp_prio.name, t.priority) as priority_name,
			t.task_status, COALESCE(gp_status.name, t.task_status) as task_status_name,
			t.assignee_id, COALESCE(u_ass.full_name, '') as assignee_name, COALESCE(u_ass.email, '') as assignee_email,
			t.created_by, COALESCE(u_cre.full_name, '') as creator_name,
			t.branch_pr_link,
			TO_CHAR(t.target_due, 'YYYY-MM-DD') as target_due,
			t.completed_at,
			t.est_hours, t.actual_hours,
			t.blocker_tech_notes,
			t.sort_order,
			t.created_at, t.updated_at
		FROM tasks t
		JOIN projects p ON t.project_id = p.id
		LEFT JOIN users u_ass ON t.assignee_id = u_ass.id
		LEFT JOIN users u_cre ON t.created_by = u_cre.id
		LEFT JOIN general_parameters gp_type ON gp_type.parameter_type = 'TASK_TYPE' AND gp_type.code = t.task_type
		LEFT JOIN general_parameters gp_prio ON gp_prio.parameter_type = 'PRIORITY' AND gp_prio.code = t.priority
		LEFT JOIN general_parameters gp_status ON gp_status.parameter_type = 'TASK_STATUS' AND gp_status.code = t.task_status
		WHERE t.id = $1
	`

	var t domain.Task
	var desc, branchLink, targetDue, blockerNotes sql.NullString
	var assigneeID, createdBy sql.NullString
	var completedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&t.ID, &t.ProjectID, &t.ProjectCode, &t.ProjectName,
		&t.TaskCode, &t.Title, &desc,
		&t.TaskType, &t.TaskTypeName,
		&t.Priority, &t.PriorityName,
		&t.TaskStatus, &t.TaskStatusName,
		&assigneeID, &t.AssigneeName, &t.AssigneeEmail,
		&createdBy, &t.CreatorName,
		&branchLink,
		&targetDue,
		&completedAt,
		&t.EstHours, &t.ActualHours,
		&blockerNotes,
		&t.SortOrder,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get task by id: %w", err)
	}

	if desc.Valid {
		t.Description = &desc.String
	}
	if branchLink.Valid {
		t.BranchPRLink = &branchLink.String
	}
	if targetDue.Valid && targetDue.String != "" {
		t.TargetDue = &targetDue.String
	}
	if blockerNotes.Valid {
		t.BlockerTechNotes = &blockerNotes.String
	}
	if assigneeID.Valid {
		t.AssigneeID = &assigneeID.String
	}
	if createdBy.Valid {
		t.CreatedBy = &createdBy.String
	}
	if completedAt.Valid {
		t.CompletedAt = &completedAt.Time
	}

	return &t, nil
}

// List retrieves tasks based on filters, ordered by sort_order and created_at
func (r *TaskRepository) List(ctx context.Context, filter domain.TaskFilter) ([]domain.Task, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	if filter.ProjectID != "" {
		conditions = append(conditions, fmt.Sprintf("t.project_id = $%d", argIdx))
		args = append(args, filter.ProjectID)
		argIdx++
	}

	if filter.AssigneeID != "" {
		conditions = append(conditions, fmt.Sprintf("t.assignee_id = $%d", argIdx))
		args = append(args, filter.AssigneeID)
		argIdx++
	}

	if filter.TaskStatus != "" {
		conditions = append(conditions, fmt.Sprintf("t.task_status = $%d", argIdx))
		args = append(args, strings.ToUpper(filter.TaskStatus))
		argIdx++
	}

	if filter.Priority != "" {
		conditions = append(conditions, fmt.Sprintf("t.priority = $%d", argIdx))
		args = append(args, strings.ToUpper(filter.Priority))
		argIdx++
	}

	if filter.TaskType != "" {
		conditions = append(conditions, fmt.Sprintf("t.task_type = $%d", argIdx))
		args = append(args, strings.ToUpper(filter.TaskType))
		argIdx++
	}

	if filter.Search != "" {
		searchPattern := "%" + strings.ToLower(filter.Search) + "%"
		conditions = append(conditions, fmt.Sprintf("(LOWER(t.task_code) LIKE $%d OR LOWER(t.title) LIKE $%d OR LOWER(COALESCE(u_ass.full_name, '')) LIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, searchPattern)
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	limitClause := ""
	if filter.Limit > 0 {
		limitClause = fmt.Sprintf("LIMIT %d", filter.Limit)
		if filter.Offset > 0 {
			limitClause += fmt.Sprintf(" OFFSET %d", filter.Offset)
		}
	}

	query := fmt.Sprintf(`
		SELECT 
			t.id, t.project_id, p.project_code, p.project_name,
			t.task_code, t.title, t.description,
			t.task_type, COALESCE(gp_type.name, t.task_type) as task_type_name,
			t.priority, COALESCE(gp_prio.name, t.priority) as priority_name,
			t.task_status, COALESCE(gp_status.name, t.task_status) as task_status_name,
			t.assignee_id, COALESCE(u_ass.full_name, '') as assignee_name, COALESCE(u_ass.email, '') as assignee_email,
			t.created_by, COALESCE(u_cre.full_name, '') as creator_name,
			t.branch_pr_link,
			TO_CHAR(t.target_due, 'YYYY-MM-DD') as target_due,
			t.completed_at,
			t.est_hours, t.actual_hours,
			t.blocker_tech_notes,
			t.sort_order,
			t.created_at, t.updated_at
		FROM tasks t
		JOIN projects p ON t.project_id = p.id
		LEFT JOIN users u_ass ON t.assignee_id = u_ass.id
		LEFT JOIN users u_cre ON t.created_by = u_cre.id
		LEFT JOIN general_parameters gp_type ON gp_type.parameter_type = 'TASK_TYPE' AND gp_type.code = t.task_type
		LEFT JOIN general_parameters gp_prio ON gp_prio.parameter_type = 'PRIORITY' AND gp_prio.code = t.priority
		LEFT JOIN general_parameters gp_status ON gp_status.parameter_type = 'TASK_STATUS' AND gp_status.code = t.task_status
		%s
		ORDER BY t.sort_order ASC, t.created_at ASC
		%s
	`, whereClause, limitClause)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}
	defer rows.Close()

	tasks := make([]domain.Task, 0)
	for rows.Next() {
		var t domain.Task
		var desc, branchLink, targetDue, blockerNotes sql.NullString
		var assigneeID, createdBy sql.NullString
		var completedAt sql.NullTime

		err := rows.Scan(
			&t.ID, &t.ProjectID, &t.ProjectCode, &t.ProjectName,
			&t.TaskCode, &t.Title, &desc,
			&t.TaskType, &t.TaskTypeName,
			&t.Priority, &t.PriorityName,
			&t.TaskStatus, &t.TaskStatusName,
			&assigneeID, &t.AssigneeName, &t.AssigneeEmail,
			&createdBy, &t.CreatorName,
			&branchLink,
			&targetDue,
			&completedAt,
			&t.EstHours, &t.ActualHours,
			&blockerNotes,
			&t.SortOrder,
			&t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan task: %w", err)
		}

		if desc.Valid {
			t.Description = &desc.String
		}
		if branchLink.Valid {
			t.BranchPRLink = &branchLink.String
		}
		if targetDue.Valid && targetDue.String != "" {
			t.TargetDue = &targetDue.String
		}
		if blockerNotes.Valid {
			t.BlockerTechNotes = &blockerNotes.String
		}
		if assigneeID.Valid {
			t.AssigneeID = &assigneeID.String
		}
		if createdBy.Valid {
			t.CreatedBy = &createdBy.String
		}
		if completedAt.Valid {
			t.CompletedAt = &completedAt.Time
		}

		tasks = append(tasks, t)
	}

	return tasks, nil
}

// Update updates task fields
func (r *TaskRepository) Update(ctx context.Context, id string, req domain.UpdateTaskRequest) (*domain.Task, error) {
	// 1. Fetch current task to check status changes
	current, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, fmt.Errorf("task tidak ditemukan")
	}

	newStatus := strings.ToUpper(strings.TrimSpace(req.TaskStatus))
	var completedAt = current.CompletedAt

	if newStatus == "DONE" && current.TaskStatus != "DONE" {
		now := time.Now()
		completedAt = &now
	} else if newStatus != "DONE" && current.TaskStatus == "DONE" {
		completedAt = nil
	}

	var targetDueVal interface{}
	if req.TargetDue != nil && strings.TrimSpace(*req.TargetDue) != "" {
		targetDueVal = *req.TargetDue
	}

	query := `
		UPDATE tasks
		SET 
			title = $1,
			description = $2,
			task_type = $3,
			priority = $4,
			task_status = $5,
			assignee_id = $6,
			branch_pr_link = $7,
			target_due = $8,
			completed_at = $9,
			est_hours = $10,
			actual_hours = $11,
			blocker_tech_notes = $12,
			sort_order = $13,
			updated_at = now()
		WHERE id = $14
	`

	_, err = r.db.ExecContext(ctx, query,
		strings.TrimSpace(req.Title),
		req.Description,
		strings.ToUpper(strings.TrimSpace(req.TaskType)),
		strings.ToUpper(strings.TrimSpace(req.Priority)),
		newStatus,
		req.AssigneeID,
		req.BranchPRLink,
		targetDueVal,
		completedAt,
		req.EstHours,
		req.ActualHours,
		req.BlockerTechNotes,
		req.SortOrder,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	return r.GetByID(ctx, id)
}

// UpdateStatus performs a fast status transition (Kanban drag-and-drop)
func (r *TaskRepository) UpdateStatus(ctx context.Context, id string, req domain.UpdateTaskStatusRequest) (*domain.Task, error) {
	current, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, fmt.Errorf("task tidak ditemukan")
	}

	newStatus := strings.ToUpper(strings.TrimSpace(req.TaskStatus))
	var completedAt = current.CompletedAt

	if newStatus == "DONE" && current.TaskStatus != "DONE" {
		now := time.Now()
		completedAt = &now
	} else if newStatus != "DONE" && current.TaskStatus == "DONE" {
		completedAt = nil
	}

	actualHours := current.ActualHours
	if req.ActualHours != nil {
		actualHours = *req.ActualHours
	}

	blockerNotes := current.BlockerTechNotes
	if req.BlockerTechNotes != nil {
		blockerNotes = req.BlockerTechNotes
	}

	query := `
		UPDATE tasks
		SET 
			task_status = $1,
			completed_at = $2,
			blocker_tech_notes = $3,
			actual_hours = $4,
			updated_at = now()
		WHERE id = $5
	`

	_, err = r.db.ExecContext(ctx, query, newStatus, completedAt, blockerNotes, actualHours, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update task status: %w", err)
	}

	return r.GetByID(ctx, id)
}

// Delete removes a task by id
func (r *TaskRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, "DELETE FROM tasks WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete task: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("task tidak ditemukan")
	}

	return nil
}

// GetStats returns summary counts and hours for a project's tasks
func (r *TaskRepository) GetStats(ctx context.Context, projectID string) (*domain.TaskStats, error) {
	query := `
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE task_status = 'DONE'),
			COUNT(*) FILTER (WHERE task_status = 'IN_PROGRESS'),
			COUNT(*) FILTER (WHERE task_status = 'BLOCKED'),
			COALESCE(SUM(est_hours), 0.00),
			COALESCE(SUM(actual_hours), 0.00)
		FROM tasks
		WHERE project_id = $1
	`

	var stats domain.TaskStats
	err := r.db.QueryRowContext(ctx, query, projectID).Scan(
		&stats.TotalTasks,
		&stats.DoneTasks,
		&stats.InProgressTasks,
		&stats.BlockedTasks,
		&stats.TotalEstHours,
		&stats.TotalActualHours,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get task stats: %w", err)
	}

	return &stats, nil
}
