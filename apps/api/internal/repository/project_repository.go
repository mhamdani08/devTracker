package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/devtracker/api/internal/domain"
)

type ProjectRepository struct {
	db *sql.DB
}

func NewProjectRepository(db *sql.DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

// List retrieves a paginated and filtered list of projects
func (r *ProjectRepository) List(ctx context.Context, filter domain.ProjectFilter) ([]domain.Project, int, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	if filter.StatusProject != "" {
		conditions = append(conditions, fmt.Sprintf("p.status_project = $%d", argIdx))
		args = append(args, filter.StatusProject)
		argIdx++
	}

	if filter.HealthStatus != "" {
		conditions = append(conditions, fmt.Sprintf("p.health_status = $%d", argIdx))
		args = append(args, filter.HealthStatus)
		argIdx++
	}

	if filter.UnitTeam != "" {
		conditions = append(conditions, fmt.Sprintf("p.unit_team = $%d", argIdx))
		args = append(args, filter.UnitTeam)
		argIdx++
	}

	if filter.Priority != "" {
		conditions = append(conditions, fmt.Sprintf("p.project_priority = $%d", argIdx))
		args = append(args, filter.Priority)
		argIdx++
	}

	if filter.Search != "" {
		searchPattern := "%" + strings.ToLower(filter.Search) + "%"
		conditions = append(conditions, fmt.Sprintf("(LOWER(p.project_code) LIKE $%d OR LOWER(p.project_name) LIKE $%d OR LOWER(COALESCE(u.full_name, '')) LIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, searchPattern)
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	// 1. Total count
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM projects p
		LEFT JOIN users u ON p.pic_user_id = u.id
		%s
	`, whereClause)

	var total int
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count projects: %w", err)
	}

	// 2. Paginated list
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	if filter.Page <= 0 {
		filter.Page = 1
	}
	offset := (filter.Page - 1) * filter.Limit

	dataQuery := fmt.Sprintf(`
		SELECT 
			p.id, p.project_code, p.project_name, p.pic_user_id,
			COALESCE(u.full_name, '') as pic_name,
			COALESCE(u.email, '') as pic_email,
			p.status_project,
			COALESCE(gp_phase.name, p.status_project) as status_project_name,
			p.source_type,
			TO_CHAR(p.start_date, 'YYYY-MM-DD') as start_date,
			TO_CHAR(p.target_date, 'YYYY-MM-DD') as target_date,
			TO_CHAR(p.real_live_date, 'YYYY-MM-DD') as real_live_date,
			p.unit_team,
			p.project_priority,
			COALESCE(gp_prio.name, p.project_priority, '') as priority_name,
			p.repository,
			p.total_task,
			p.total_task_done,
			p.progress_percentage,
			p.active_blockers,
			p.health_status,
			COALESCE(gp_health.name, p.health_status, '') as health_status_name,
			p.key_risk_notes,
			p.estimated_mandays,
			p.actual_mandays,
			p.created_at,
			p.updated_at
		FROM projects p
		LEFT JOIN users u ON p.pic_user_id = u.id
		LEFT JOIN general_parameters gp_phase ON gp_phase.parameter_type = 'PROJECT_PHASE' AND gp_phase.code = p.status_project
		LEFT JOIN general_parameters gp_prio ON gp_prio.parameter_type = 'PRIORITY' AND gp_prio.code = p.project_priority
		LEFT JOIN general_parameters gp_health ON gp_health.parameter_type = 'PROJECT_HEALTH' AND gp_health.code = p.health_status
		%s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, filter.Limit, offset)

	rows, err := r.db.QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query projects: %w", err)
	}
	defer rows.Close()

	var projects []domain.Project
	for rows.Next() {
		var p domain.Project
		var realLive sql.NullString
		var priority sql.NullString
		var repo sql.NullString
		var blockers sql.NullString
		var health sql.NullString
		var risks sql.NullString
		var estMandays sql.NullInt64
		var actMandays sql.NullInt64
		var picID sql.NullString

		err := rows.Scan(
			&p.ID, &p.ProjectCode, &p.ProjectName, &picID,
			&p.PICName, &p.PICEmail,
			&p.StatusProject, &p.StatusProjectName,
			&p.SourceType, &p.StartDate, &p.TargetDate, &realLive,
			&p.UnitTeam, &priority, &p.PriorityName,
			&repo, &p.TotalTask, &p.TotalTaskDone, &p.ProgressPercentage,
			&blockers, &health, &p.HealthStatusName,
			&risks, &estMandays, &actMandays,
			&p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan project: %w", err)
		}

		if picID.Valid {
			p.PICUserID = &picID.String
		}
		if realLive.Valid {
			p.RealLiveDate = &realLive.String
		}
		if priority.Valid {
			p.ProjectPriority = &priority.String
		}
		if repo.Valid {
			p.Repository = &repo.String
		}
		if blockers.Valid {
			p.ActiveBlockers = &blockers.String
		}
		if health.Valid {
			p.HealthStatus = &health.String
		}
		if risks.Valid {
			p.KeyRiskNotes = &risks.String
		}
		if estMandays.Valid {
			val := int(estMandays.Int64)
			p.EstimatedMandays = &val
		}
		if actMandays.Valid {
			val := int(actMandays.Int64)
			p.ActualMandays = &val
		}

		projects = append(projects, p)
	}

	return projects, total, nil
}

// GetByID retrieves project detail including members and documents
func (r *ProjectRepository) GetByID(ctx context.Context, id string) (*domain.ProjectDetail, error) {
	query := `
		SELECT 
			p.id, p.project_code, p.project_name, p.pic_user_id,
			COALESCE(u.full_name, '') as pic_name,
			COALESCE(u.email, '') as pic_email,
			p.status_project,
			COALESCE(gp_phase.name, p.status_project) as status_project_name,
			p.source_type,
			TO_CHAR(p.start_date, 'YYYY-MM-DD') as start_date,
			TO_CHAR(p.target_date, 'YYYY-MM-DD') as target_date,
			TO_CHAR(p.real_live_date, 'YYYY-MM-DD') as real_live_date,
			p.unit_team,
			p.project_priority,
			COALESCE(gp_prio.name, p.project_priority, '') as priority_name,
			p.repository,
			p.total_task,
			p.total_task_done,
			p.progress_percentage,
			p.active_blockers,
			p.health_status,
			COALESCE(gp_health.name, p.health_status, '') as health_status_name,
			p.key_risk_notes,
			p.estimated_mandays,
			p.actual_mandays,
			p.created_at,
			p.updated_at
		FROM projects p
		LEFT JOIN users u ON p.pic_user_id = u.id
		LEFT JOIN general_parameters gp_phase ON gp_phase.parameter_type = 'PROJECT_PHASE' AND gp_phase.code = p.status_project
		LEFT JOIN general_parameters gp_prio ON gp_prio.parameter_type = 'PRIORITY' AND gp_prio.code = p.project_priority
		LEFT JOIN general_parameters gp_health ON gp_health.parameter_type = 'PROJECT_HEALTH' AND gp_health.code = p.health_status
		WHERE p.id = $1
	`

	var p domain.Project
	var realLive sql.NullString
	var priority sql.NullString
	var repo sql.NullString
	var blockers sql.NullString
	var health sql.NullString
	var risks sql.NullString
	var estMandays sql.NullInt64
	var actMandays sql.NullInt64
	var picID sql.NullString

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&p.ID, &p.ProjectCode, &p.ProjectName, &picID,
		&p.PICName, &p.PICEmail,
		&p.StatusProject, &p.StatusProjectName,
		&p.SourceType, &p.StartDate, &p.TargetDate, &realLive,
		&p.UnitTeam, &priority, &p.PriorityName,
		&repo, &p.TotalTask, &p.TotalTaskDone, &p.ProgressPercentage,
		&blockers, &health, &p.HealthStatusName,
		&risks, &estMandays, &actMandays,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get project by id: %w", err)
	}

	if picID.Valid {
		p.PICUserID = &picID.String
	}
	if realLive.Valid {
		p.RealLiveDate = &realLive.String
	}
	if priority.Valid {
		p.ProjectPriority = &priority.String
	}
	if repo.Valid {
		p.Repository = &repo.String
	}
	if blockers.Valid {
		p.ActiveBlockers = &blockers.String
	}
	if health.Valid {
		p.HealthStatus = &health.String
	}
	if risks.Valid {
		p.KeyRiskNotes = &risks.String
	}
	if estMandays.Valid {
		val := int(estMandays.Int64)
		p.EstimatedMandays = &val
	}
	if actMandays.Valid {
		val := int(actMandays.Int64)
		p.ActualMandays = &val
	}

	members, err := r.ListMembers(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get members: %w", err)
	}

	documents, err := r.ListDocuments(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get documents: %w", err)
	}

	return &domain.ProjectDetail{
		Project:   p,
		Members:   members,
		Documents: documents,
	}, nil
}

// Create inserts a new project
func (r *ProjectRepository) Create(ctx context.Context, p *domain.Project) error {
	query := `
		INSERT INTO projects (
			project_code, project_name, pic_user_id, status_project, source_type,
			start_date, target_date, real_live_date, unit_team, project_priority,
			repository, total_task, total_task_done, progress_percentage,
			active_blockers, health_status, key_risk_notes,
			estimated_mandays, actual_mandays, created_at, updated_at
		) VALUES (
			$1, $2, NULLIF($3, '')::uuid, $4, $5,
			$6::date, $7::date, NULLIF($8, '')::date, $9, $10,
			$11, $12, $13, $14,
			$15, $16, $17,
			$18, $19, now(), now()
		)
		RETURNING id, created_at, updated_at
	`

	var realLiveStr string
	if p.RealLiveDate != nil {
		realLiveStr = *p.RealLiveDate
	}

	var picIDStr string
	if p.PICUserID != nil {
		picIDStr = *p.PICUserID
	}

	return r.db.QueryRowContext(
		ctx, query,
		p.ProjectCode, p.ProjectName, picIDStr, p.StatusProject, p.SourceType,
		p.StartDate, p.TargetDate, realLiveStr, p.UnitTeam, p.ProjectPriority,
		p.Repository, p.TotalTask, p.TotalTaskDone, p.ProgressPercentage,
		p.ActiveBlockers, p.HealthStatus, p.KeyRiskNotes,
		p.EstimatedMandays, p.ActualMandays,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

// Update updates an existing project
func (r *ProjectRepository) Update(ctx context.Context, p *domain.Project) error {
	query := `
		UPDATE projects SET
			project_code = $1,
			project_name = $2,
			pic_user_id = NULLIF($3, '')::uuid,
			status_project = $4,
			source_type = $5,
			start_date = $6::date,
			target_date = $7::date,
			real_live_date = NULLIF($8, '')::date,
			unit_team = $9,
			project_priority = $10,
			repository = $11,
			active_blockers = $12,
			health_status = $13,
			key_risk_notes = $14,
			estimated_mandays = $15,
			actual_mandays = $16,
			updated_at = now()
		WHERE id = $17
		RETURNING updated_at
	`

	var realLiveStr string
	if p.RealLiveDate != nil {
		realLiveStr = *p.RealLiveDate
	}

	var picIDStr string
	if p.PICUserID != nil {
		picIDStr = *p.PICUserID
	}

	return r.db.QueryRowContext(
		ctx, query,
		p.ProjectCode, p.ProjectName, picIDStr, p.StatusProject, p.SourceType,
		p.StartDate, p.TargetDate, realLiveStr, p.UnitTeam, p.ProjectPriority,
		p.Repository, p.ActiveBlockers, p.HealthStatus, p.KeyRiskNotes,
		p.EstimatedMandays, p.ActualMandays, p.ID,
	).Scan(&p.UpdatedAt)
}

// Delete removes a project
func (r *ProjectRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM projects WHERE id = $1`
	res, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete project: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetStats calculates high-level KPI stats
func (r *ProjectRepository) GetStats(ctx context.Context) (*domain.ProjectStats, error) {
	stats := &domain.ProjectStats{
		HealthCounts: make(map[string]int),
		PhaseCounts:  make(map[string]int),
	}

	// 1. Total and mandays
	totalsQuery := `
		SELECT 
			COUNT(*), 
			COALESCE(SUM(estimated_mandays), 0),
			COALESCE(SUM(actual_mandays), 0)
		FROM projects
	`
	err := r.db.QueryRowContext(ctx, totalsQuery).Scan(
		&stats.TotalProjects,
		&stats.TotalEstimated,
		&stats.TotalActual,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query project totals: %w", err)
	}

	// 2. Health distribution
	healthQuery := `
		SELECT COALESCE(health_status, 'UNSPECIFIED'), COUNT(*)
		FROM projects
		GROUP BY health_status
	`
	hRows, err := r.db.QueryContext(ctx, healthQuery)
	if err == nil {
		defer hRows.Close()
		for hRows.Next() {
			var code string
			var count int
			if err := hRows.Scan(&code, &count); err == nil {
				stats.HealthCounts[code] = count
			}
		}
	}

	// 3. Phase distribution
	phaseQuery := `
		SELECT status_project, COUNT(*)
		FROM projects
		GROUP BY status_project
	`
	pRows, err := r.db.QueryContext(ctx, phaseQuery)
	if err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var code string
			var count int
			if err := pRows.Scan(&code, &count); err == nil {
				stats.PhaseCounts[code] = count
			}
		}
	}

	return stats, nil
}

// CheckProjectCodeExists verifies if a project code is already taken
func (r *ProjectRepository) CheckProjectCodeExists(ctx context.Context, code string, excludeID string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM projects WHERE LOWER(project_code) = LOWER($1) AND ($2 = '' OR id != $2::uuid))`
	var exists bool
	err := r.db.QueryRowContext(ctx, query, code, excludeID).Scan(&exists)
	return exists, err
}

// =========================================================================
// PROJECT MEMBERS REPOSITORY
// =========================================================================

func (r *ProjectRepository) ListMembers(ctx context.Context, projectID string) ([]domain.ProjectMember, error) {
	query := `
		SELECT 
			pm.project_id, pm.user_id,
			COALESCE(u.full_name, '') as user_full_name,
			COALESCE(u.email, '') as user_email,
			COALESCE(r.code, '') as user_role_code,
			pm.role, pm.joined_at, pm.invited_by,
			COALESCE(inv.full_name, '') as invited_by_name,
			pm.created_at, pm.updated_at
		FROM project_members pm
		JOIN users u ON pm.user_id = u.id
		LEFT JOIN roles r ON u.role_id = r.id
		LEFT JOIN users inv ON pm.invited_by = inv.id
		WHERE pm.project_id = $1
		ORDER BY pm.joined_at ASC
	`

	rows, err := r.db.QueryContext(ctx, query, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to query project members: %w", err)
	}
	defer rows.Close()

	var members []domain.ProjectMember
	for rows.Next() {
		var m domain.ProjectMember
		var invID sql.NullString
		err := rows.Scan(
			&m.ProjectID, &m.UserID,
			&m.UserFullName, &m.UserEmail, &m.UserRoleCode,
			&m.Role, &m.JoinedAt, &invID, &m.InvitedByName,
			&m.CreatedAt, &m.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan project member: %w", err)
		}
		if invID.Valid {
			m.InvitedBy = &invID.String
		}
		members = append(members, m)
	}

	return members, nil
}

func (r *ProjectRepository) AddMember(ctx context.Context, m *domain.ProjectMember) error {
	query := `
		INSERT INTO project_members (
			project_id, user_id, role, joined_at, invited_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, now(), $4, now(), now()
		)
		ON CONFLICT (project_id, user_id) DO UPDATE SET
			role = EXCLUDED.role,
			updated_at = now()
	`
	_, err := r.db.ExecContext(ctx, query, m.ProjectID, m.UserID, m.Role, m.InvitedBy)
	return err
}

func (r *ProjectRepository) RemoveMember(ctx context.Context, projectID, userID string) error {
	query := `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`
	res, err := r.db.ExecContext(ctx, query, projectID, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// =========================================================================
// PROJECT DOCUMENTS REPOSITORY
// =========================================================================

func (r *ProjectRepository) ListDocuments(ctx context.Context, projectID string) ([]domain.ProjectDocument, error) {
	query := `
		SELECT 
			d.id, d.project_id, d.doc_name, d.doc_type, d.file_url,
			d.storage_type, d.file_size_bytes, d.uploaded_by,
			COALESCE(u.full_name, '') as uploader_name,
			d.created_at
		FROM project_documents d
		LEFT JOIN users u ON d.uploaded_by = u.id
		WHERE d.project_id = $1
		ORDER BY d.created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to query project documents: %w", err)
	}
	defer rows.Close()

	var docs []domain.ProjectDocument
	for rows.Next() {
		var d domain.ProjectDocument
		var docType sql.NullString
		var fileSize sql.NullInt64
		var upID sql.NullString

		err := rows.Scan(
			&d.ID, &d.ProjectID, &d.DocName, &docType, &d.FileURL,
			&d.StorageType, &fileSize, &upID, &d.UploaderName,
			&d.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan project document: %w", err)
		}

		if docType.Valid {
			d.DocType = &docType.String
		}
		if fileSize.Valid {
			d.FileSizeBytes = &fileSize.Int64
		}
		if upID.Valid {
			d.UploadedBy = &upID.String
		}

		docs = append(docs, d)
	}

	return docs, nil
}

func (r *ProjectRepository) AddDocument(ctx context.Context, doc *domain.ProjectDocument) error {
	query := `
		INSERT INTO project_documents (
			project_id, doc_name, doc_type, file_url, storage_type, file_size_bytes, uploaded_by, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, now()
		)
		RETURNING id, created_at
	`
	if doc.StorageType == "" {
		doc.StorageType = "EXTERNAL_LINK"
	}

	return r.db.QueryRowContext(
		ctx, query,
		doc.ProjectID, doc.DocName, doc.DocType, doc.FileURL,
		doc.StorageType, doc.FileSizeBytes, doc.UploadedBy,
	).Scan(&doc.ID, &doc.CreatedAt)
}

func (r *ProjectRepository) RemoveDocument(ctx context.Context, projectID, docID string) error {
	query := `DELETE FROM project_documents WHERE project_id = $1 AND id = $2`
	res, err := r.db.ExecContext(ctx, query, projectID, docID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}
