package domain

import "time"

type Task struct {
	ID               string     `json:"id"`
	ProjectID        string     `json:"project_id"`
	ProjectCode      string     `json:"project_code,omitempty"`
	ProjectName      string     `json:"project_name,omitempty"`
	TaskCode         string     `json:"task_code"`
	Title            string     `json:"title"`
	Description      *string    `json:"description,omitempty"`
	TaskType         string     `json:"task_type"`
	TaskTypeName     string     `json:"task_type_name,omitempty"`
	Priority         string     `json:"priority"`
	PriorityName     string     `json:"priority_name,omitempty"`
	TaskStatus       string     `json:"task_status"`
	TaskStatusName   string     `json:"task_status_name,omitempty"`
	AssigneeID       *string    `json:"assignee_id,omitempty"`
	AssigneeName     string     `json:"assignee_name,omitempty"`
	AssigneeEmail    string     `json:"assignee_email,omitempty"`
	CreatedBy        *string    `json:"created_by,omitempty"`
	CreatorName      string     `json:"creator_name,omitempty"`
	BranchPRLink     *string    `json:"branch_pr_link,omitempty"`
	TargetDue        *string    `json:"target_due,omitempty"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	EstHours         float64    `json:"est_hours"`
	ActualHours      float64    `json:"actual_hours"`
	BlockerTechNotes *string    `json:"blocker_tech_notes,omitempty"`
	SortOrder        int        `json:"sort_order"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type CreateTaskRequest struct {
	Title            string  `json:"title"`
	Description      *string `json:"description"`
	TaskType         string  `json:"task_type"`
	Priority         string  `json:"priority"`
	TaskStatus       string  `json:"task_status"`
	AssigneeID       *string `json:"assignee_id"`
	BranchPRLink     *string `json:"branch_pr_link"`
	TargetDue        *string `json:"target_due"`
	EstHours         float64 `json:"est_hours"`
	ActualHours      float64 `json:"actual_hours"`
	BlockerTechNotes *string `json:"blocker_tech_notes"`
	SortOrder        int     `json:"sort_order"`
}

type UpdateTaskRequest struct {
	Title            string  `json:"title"`
	Description      *string `json:"description"`
	TaskType         string  `json:"task_type"`
	Priority         string  `json:"priority"`
	TaskStatus       string  `json:"task_status"`
	AssigneeID       *string `json:"assignee_id"`
	BranchPRLink     *string `json:"branch_pr_link"`
	TargetDue        *string `json:"target_due"`
	EstHours         float64 `json:"est_hours"`
	ActualHours      float64 `json:"actual_hours"`
	BlockerTechNotes *string `json:"blocker_tech_notes"`
	SortOrder        int     `json:"sort_order"`
}

type UpdateTaskStatusRequest struct {
	TaskStatus       string   `json:"task_status"`
	BlockerTechNotes *string  `json:"blocker_tech_notes"`
	ActualHours      *float64 `json:"actual_hours"`
}

type TaskFilter struct {
	ProjectID  string
	AssigneeID string
	TaskStatus string
	Priority   string
	TaskType   string
	Search     string
	Limit      int
	Offset     int
}

type TaskStats struct {
	TotalTasks       int     `json:"total_tasks"`
	DoneTasks        int     `json:"done_tasks"`
	InProgressTasks  int     `json:"in_progress_tasks"`
	BlockedTasks     int     `json:"blocked_tasks"`
	TotalEstHours    float64 `json:"total_est_hours"`
	TotalActualHours float64 `json:"total_actual_hours"`
}
