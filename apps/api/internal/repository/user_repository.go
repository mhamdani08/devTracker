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
	ErrUserNotFound = errors.New("user not found")
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `
		SELECT 
			u.id, 
			u.role_id, 
			u.email, 
			u.full_name, 
			u.password_hash, 
			u.system_role, 
			u.status, 
			u.last_login_at, 
			u.created_at, 
			u.updated_at, 
			u.deleted_at,
			COALESCE(ro.code, '') AS role_code,
			COALESCE(ro.name, '') AS role_name
		FROM users u
		LEFT JOIN roles ro ON u.role_id = ro.id
		WHERE lower(u.email) = lower($1) AND u.deleted_at IS NULL
		LIMIT 1;
	`

	cleanEmail := strings.TrimSpace(email)
	row := r.db.QueryRowContext(ctx, query, cleanEmail)

	var u domain.User
	var roleID sql.NullString
	var lastLoginAt sql.NullTime
	var deletedAt sql.NullTime

	err := row.Scan(
		&u.ID,
		&roleID,
		&u.Email,
		&u.FullName,
		&u.PasswordHash,
		&u.SystemRole,
		&u.Status,
		&lastLoginAt,
		&u.CreatedAt,
		&u.UpdatedAt,
		&deletedAt,
		&u.RoleCode,
		&u.RoleName,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("error querying user by email: %w", err)
	}

	if roleID.Valid {
		val := roleID.String
		u.RoleID = &val
	}
	if lastLoginAt.Valid {
		val := lastLoginAt.Time
		u.LastLoginAt = &val
	}
	if deletedAt.Valid {
		val := deletedAt.Time
		u.DeletedAt = &val
	}

	return &u, nil
}

func (r *UserRepository) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	query := `
		SELECT 
			u.id, 
			u.role_id, 
			u.email, 
			u.full_name, 
			u.password_hash, 
			u.system_role, 
			u.status, 
			u.last_login_at, 
			u.created_at, 
			u.updated_at, 
			u.deleted_at,
			COALESCE(ro.code, '') AS role_code,
			COALESCE(ro.name, '') AS role_name
		FROM users u
		LEFT JOIN roles ro ON u.role_id = ro.id
		WHERE u.id = $1 AND u.deleted_at IS NULL
		LIMIT 1;
	`

	row := r.db.QueryRowContext(ctx, query, id)

	var u domain.User
	var roleID sql.NullString
	var lastLoginAt sql.NullTime
	var deletedAt sql.NullTime

	err := row.Scan(
		&u.ID,
		&roleID,
		&u.Email,
		&u.FullName,
		&u.PasswordHash,
		&u.SystemRole,
		&u.Status,
		&lastLoginAt,
		&u.CreatedAt,
		&u.UpdatedAt,
		&deletedAt,
		&u.RoleCode,
		&u.RoleName,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("error querying user by id: %w", err)
	}

	if roleID.Valid {
		val := roleID.String
		u.RoleID = &val
	}
	if lastLoginAt.Valid {
		val := lastLoginAt.Time
		u.LastLoginAt = &val
	}
	if deletedAt.Valid {
		val := deletedAt.Time
		u.DeletedAt = &val
	}

	return &u, nil
}

func (r *UserRepository) UpdateLastLogin(ctx context.Context, userID string) error {
	query := `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1;`
	_, err := r.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("error updating last login: %w", err)
	}
	return nil
}

func (r *UserRepository) ListRoles(ctx context.Context) ([]domain.Role, error) {
	query := `SELECT id, code, name, COALESCE(description, ''), created_at, updated_at FROM roles ORDER BY name ASC;`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("error querying roles: %w", err)
	}
	defer rows.Close()

	var roles []domain.Role
	for rows.Next() {
		var ro domain.Role
		if err := rows.Scan(&ro.ID, &ro.Code, &ro.Name, &ro.Description, &ro.CreatedAt, &ro.UpdatedAt); err != nil {
			return nil, err
		}
		roles = append(roles, ro)
	}
	return roles, nil
}

func (r *UserRepository) ListUsers(ctx context.Context) ([]domain.UserResponse, error) {
	query := `
		SELECT 
			u.id, u.email, u.full_name, u.system_role, u.status,
			COALESCE(ro.code, '') AS role_code,
			COALESCE(ro.name, '') AS role_name,
			u.last_login_at
		FROM users u
		LEFT JOIN roles ro ON u.role_id = ro.id
		WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE'
		ORDER BY u.full_name ASC;
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("error querying users: %w", err)
	}
	defer rows.Close()

	var users []domain.UserResponse
	for rows.Next() {
		var u domain.UserResponse
		var lastLogin sql.NullTime
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.SystemRole, &u.Status, &u.RoleCode, &u.RoleName, &lastLogin); err != nil {
			return nil, err
		}
		if lastLogin.Valid {
			t := lastLogin.Time
			u.LastLoginAt = &t
		}
		users = append(users, u)
	}
	return users, nil
}
