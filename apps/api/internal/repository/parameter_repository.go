package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/devtracker/api/internal/domain"
)

var (
	ErrParameterNotFound      = errors.New("parameter tidak ditemukan")
	ErrParameterAlreadyExists = errors.New("kode parameter untuk tipe tersebut sudah ada")
)

type ParameterRepository struct {
	db *sql.DB
}

func NewParameterRepository(db *sql.DB) *ParameterRepository {
	return &ParameterRepository{db: db}
}

func (r *ParameterRepository) ListParameters(ctx context.Context, paramType string, activeOnly bool, search string) ([]domain.GeneralParameter, error) {
	query := `
		SELECT id, parameter_type, code, name, sort_order, is_active, created_at, updated_at
		FROM general_parameters
		WHERE 1=1
	`
	var args []interface{}
	argIdx := 1

	if paramType != "" {
		query += fmt.Sprintf(" AND upper(parameter_type) = upper($%d)", argIdx)
		args = append(args, paramType)
		argIdx++
	}

	if activeOnly {
		query += fmt.Sprintf(" AND is_active = $%d", argIdx)
		args = append(args, true)
		argIdx++
	}

	if search != "" {
		searchPattern := "%" + strings.TrimSpace(search) + "%"
		query += fmt.Sprintf(" AND (name ILIKE $%d OR code ILIKE $%d)", argIdx, argIdx)
		args = append(args, searchPattern)
		argIdx++
	}

	query += " ORDER BY parameter_type ASC, sort_order ASC, name ASC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("error querying parameters: %w", err)
	}
	defer rows.Close()

	var params []domain.GeneralParameter
	for rows.Next() {
		var p domain.GeneralParameter
		if err := rows.Scan(
			&p.ID,
			&p.ParameterType,
			&p.Code,
			&p.Name,
			&p.SortOrder,
			&p.IsActive,
			&p.CreatedAt,
			&p.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning parameter: %w", err)
		}
		params = append(params, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating parameter rows: %w", err)
	}

	return params, nil
}

func (r *ParameterRepository) ListParameterTypes(ctx context.Context) ([]domain.ParameterTypeSummary, error) {
	query := `
		SELECT 
			parameter_type, 
			COUNT(*) AS total_count,
			COUNT(*) FILTER (WHERE is_active = true) AS active_count
		FROM general_parameters
		GROUP BY parameter_type
		ORDER BY parameter_type ASC;
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("error querying parameter types: %w", err)
	}
	defer rows.Close()

	var summaries []domain.ParameterTypeSummary
	for rows.Next() {
		var s domain.ParameterTypeSummary
		if err := rows.Scan(&s.ParameterType, &s.Count, &s.ActiveCount); err != nil {
			return nil, fmt.Errorf("error scanning parameter summary: %w", err)
		}
		summaries = append(summaries, s)
	}

	return summaries, nil
}

func (r *ParameterRepository) GetParameterByID(ctx context.Context, id string) (*domain.GeneralParameter, error) {
	query := `
		SELECT id, parameter_type, code, name, sort_order, is_active, created_at, updated_at
		FROM general_parameters
		WHERE id = $1
		LIMIT 1;
	`
	var p domain.GeneralParameter
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&p.ID,
		&p.ParameterType,
		&p.Code,
		&p.Name,
		&p.SortOrder,
		&p.IsActive,
		&p.CreatedAt,
		&p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrParameterNotFound
		}
		return nil, fmt.Errorf("error querying parameter by id: %w", err)
	}
	return &p, nil
}

func (r *ParameterRepository) GetParameterByTypeCode(ctx context.Context, paramType, code string) (*domain.GeneralParameter, error) {
	query := `
		SELECT id, parameter_type, code, name, sort_order, is_active, created_at, updated_at
		FROM general_parameters
		WHERE upper(parameter_type) = upper($1) AND upper(code) = upper($2)
		LIMIT 1;
	`
	var p domain.GeneralParameter
	err := r.db.QueryRowContext(ctx, query, paramType, code).Scan(
		&p.ID,
		&p.ParameterType,
		&p.Code,
		&p.Name,
		&p.SortOrder,
		&p.IsActive,
		&p.CreatedAt,
		&p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrParameterNotFound
		}
		return nil, fmt.Errorf("error querying parameter by type & code: %w", err)
	}
	return &p, nil
}

func (r *ParameterRepository) CreateParameter(ctx context.Context, p domain.GeneralParameter) (*domain.GeneralParameter, error) {
	query := `
		INSERT INTO general_parameters (parameter_type, code, name, sort_order, is_active, created_at, updated_at)
		VALUES (upper($1), upper($2), $3, $4, $5, now(), now())
		RETURNING id, parameter_type, code, name, sort_order, is_active, created_at, updated_at;
	`
	var created domain.GeneralParameter
	err := r.db.QueryRowContext(
		ctx,
		query,
		p.ParameterType,
		p.Code,
		p.Name,
		p.SortOrder,
		p.IsActive,
	).Scan(
		&created.ID,
		&created.ParameterType,
		&created.Code,
		&created.Name,
		&created.SortOrder,
		&created.IsActive,
		&created.CreatedAt,
		&created.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "ix_general_parameters_type_code") || strings.Contains(err.Error(), "unique constraint") {
			return nil, ErrParameterAlreadyExists
		}
		return nil, fmt.Errorf("error inserting parameter: %w", err)
	}

	return &created, nil
}

func (r *ParameterRepository) UpdateParameter(ctx context.Context, id string, req domain.UpdateParameterRequest) (*domain.GeneralParameter, error) {
	existing, err := r.GetParameterByID(ctx, id)
	if err != nil {
		return nil, err
	}

	name := existing.Name
	if req.Name != "" {
		name = req.Name
	}
	sortOrder := req.SortOrder
	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	query := `
		UPDATE general_parameters
		SET name = $1, sort_order = $2, is_active = $3, updated_at = now()
		WHERE id = $4
		RETURNING id, parameter_type, code, name, sort_order, is_active, created_at, updated_at;
	`
	var updated domain.GeneralParameter
	err = r.db.QueryRowContext(ctx, query, name, sortOrder, isActive, id).Scan(
		&updated.ID,
		&updated.ParameterType,
		&updated.Code,
		&updated.Name,
		&updated.SortOrder,
		&updated.IsActive,
		&updated.CreatedAt,
		&updated.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("error updating parameter: %w", err)
	}

	return &updated, nil
}

func (r *ParameterRepository) ToggleActive(ctx context.Context, id string) (*domain.GeneralParameter, error) {
	query := `
		UPDATE general_parameters
		SET is_active = NOT is_active, updated_at = now()
		WHERE id = $1
		RETURNING id, parameter_type, code, name, sort_order, is_active, created_at, updated_at;
	`
	var updated domain.GeneralParameter
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&updated.ID,
		&updated.ParameterType,
		&updated.Code,
		&updated.Name,
		&updated.SortOrder,
		&updated.IsActive,
		&updated.CreatedAt,
		&updated.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrParameterNotFound
		}
		return nil, fmt.Errorf("error toggling parameter active status: %w", err)
	}

	return &updated, nil
}

func (r *ParameterRepository) DeleteParameter(ctx context.Context, id string) error {
	query := `DELETE FROM general_parameters WHERE id = $1;`
	res, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("error deleting parameter: %w", err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("error getting rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return ErrParameterNotFound
	}
	return nil
}
