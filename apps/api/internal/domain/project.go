package domain

import "time"

type ProjectMemberRole string

const (
	ProjectMemberRoleOwner          ProjectMemberRole = "OWNER"
	ProjectMemberRoleProjectManager ProjectMemberRole = "PROJECT_MANAGER"
	ProjectMemberRoleDeveloper      ProjectMemberRole = "DEVELOPER"
	ProjectMemberRoleViewer         ProjectMemberRole = "VIEWER"
)

type Project struct {
	ID                 string     `json:"id"`
	ProjectCode        string     `json:"project_code"`
	ProjectName        string     `json:"project_name"`
	PICUserID          *string    `json:"pic_user_id,omitempty"`
	PICName            string     `json:"pic_name,omitempty"`
	PICEmail           string     `json:"pic_email,omitempty"`
	StatusProject      string     `json:"status_project"`
	StatusProjectName  string     `json:"status_project_name,omitempty"`
	SourceType         string     `json:"source_type"`
	StartDate          string     `json:"start_date"`
	TargetDate         string     `json:"target_date"`
	RealLiveDate       *string    `json:"real_live_date,omitempty"`
	UnitTeam           string     `json:"unit_team"`
	ProjectPriority    *string    `json:"project_priority,omitempty"`
	PriorityName       string     `json:"priority_name,omitempty"`
	Repository         *string    `json:"repository,omitempty"`
	TotalTask          int        `json:"total_task"`
	TotalTaskDone      int        `json:"total_task_done"`
	ProgressPercentage float64    `json:"progress_percentage"`
	ActiveBlockers     *string    `json:"active_blockers,omitempty"`
	HealthStatus       *string    `json:"health_status,omitempty"`
	HealthStatusName   string     `json:"health_status_name,omitempty"`
	KeyRiskNotes       *string    `json:"key_risk_notes,omitempty"`
	EstimatedMandays   *int       `json:"estimated_mandays,omitempty"`
	ActualMandays      *int       `json:"actual_mandays,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type ProjectDocument struct {
	ID            string    `json:"id"`
	ProjectID     string    `json:"project_id"`
	DocName       string    `json:"doc_name"`
	DocType       *string   `json:"doc_type,omitempty"`
	FileURL       string    `json:"file_url"`
	StorageType   string    `json:"storage_type"`
	FileSizeBytes *int64    `json:"file_size_bytes,omitempty"`
	UploadedBy    *string   `json:"uploaded_by,omitempty"`
	UploaderName  string    `json:"uploader_name,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type ProjectMember struct {
	ProjectID     string    `json:"project_id"`
	UserID        string    `json:"user_id"`
	UserFullName  string    `json:"user_full_name"`
	UserEmail     string    `json:"user_email"`
	UserRoleCode  string    `json:"user_role_code,omitempty"`
	Role          string    `json:"role"`
	JoinedAt      time.Time `json:"joined_at"`
	InvitedBy     *string   `json:"invited_by,omitempty"`
	InvitedByName string    `json:"invited_by_name,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ProjectDetail struct {
	Project
	Members   []ProjectMember   `json:"members"`
	Documents []ProjectDocument `json:"documents"`
}

type CreateProjectRequest struct {
	ProjectCode      string  `json:"project_code"`
	ProjectName      string  `json:"project_name"`
	PICUserID        *string `json:"pic_user_id"`
	StatusProject    string  `json:"status_project"`
	SourceType       string  `json:"source_type"`
	StartDate        string  `json:"start_date"`
	TargetDate       string  `json:"target_date"`
	RealLiveDate     *string `json:"real_live_date"`
	UnitTeam         string  `json:"unit_team"`
	ProjectPriority  *string `json:"project_priority"`
	Repository       *string `json:"repository"`
	ActiveBlockers   *string `json:"active_blockers"`
	HealthStatus     *string `json:"health_status"`
	KeyRiskNotes     *string `json:"key_risk_notes"`
	EstimatedMandays *int    `json:"estimated_mandays"`
	ActualMandays    *int    `json:"actual_mandays"`
}

type UpdateProjectRequest struct {
	ProjectCode      string  `json:"project_code"`
	ProjectName      string  `json:"project_name"`
	PICUserID        *string `json:"pic_user_id"`
	StatusProject    string  `json:"status_project"`
	SourceType       string  `json:"source_type"`
	StartDate        string  `json:"start_date"`
	TargetDate       string  `json:"target_date"`
	RealLiveDate     *string `json:"real_live_date"`
	UnitTeam         string  `json:"unit_team"`
	ProjectPriority  *string `json:"project_priority"`
	Repository       *string `json:"repository"`
	ActiveBlockers   *string `json:"active_blockers"`
	HealthStatus     *string `json:"health_status"`
	KeyRiskNotes     *string `json:"key_risk_notes"`
	EstimatedMandays *int    `json:"estimated_mandays"`
	ActualMandays    *int    `json:"actual_mandays"`
}

type AddProjectMemberRequest struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

type AddProjectDocumentRequest struct {
	DocName       string `json:"doc_name"`
	DocType       string `json:"doc_type"`
	FileURL       string `json:"file_url"`
	StorageType   string `json:"storage_type,omitempty"`
	FileSizeBytes *int64 `json:"file_size_bytes,omitempty"`
}

type ProjectFilter struct {
	StatusProject string
	HealthStatus  string
	UnitTeam      string
	Priority      string
	Search        string
	Page          int
	Limit         int
}

type ProjectStats struct {
	TotalProjects  int            `json:"total_projects"`
	HealthCounts   map[string]int `json:"health_counts"`
	PhaseCounts    map[string]int `json:"phase_counts"`
	TotalEstimated int            `json:"total_estimated_mandays"`
	TotalActual    int            `json:"total_actual_mandays"`
}
