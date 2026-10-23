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
	return r.ListUsersFiltered(ctx, domain.UserFilter{IncludeInactive: false})
}

func (r *UserRepository) ListUsersFiltered(ctx context.Context, filter domain.UserFilter) ([]domain.UserResponse, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, "u.deleted_at IS NULL")

	if !filter.IncludeInactive {
		conditions = append(conditions, fmt.Sprintf("u.status = $%d", argIdx))
		args = append(args, "ACTIVE")
		argIdx++
	} else if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("u.status = $%d", argIdx))
		args = append(args, strings.ToUpper(filter.Status))
		argIdx++
	}

	if filter.RoleID != "" {
		conditions = append(conditions, fmt.Sprintf("u.role_id = $%d", argIdx))
		args = append(args, filter.RoleID)
		argIdx++
	}

	if filter.SystemRole != "" {
		conditions = append(conditions, fmt.Sprintf("u.system_role = $%d", argIdx))
		args = append(args, strings.ToUpper(filter.SystemRole))
		argIdx++
	}

	if filter.Search != "" {
		pattern := "%" + strings.ToLower(strings.TrimSpace(filter.Search)) + "%"
		conditions = append(conditions, fmt.Sprintf("(LOWER(u.full_name) LIKE $%d OR LOWER(u.email) LIKE $%d)", argIdx, argIdx))
		args = append(args, pattern)
		argIdx++
	}

	whereClause := "WHERE " + strings.Join(conditions, " AND ")

	query := fmt.Sprintf(`
		SELECT 
			u.id, u.email, u.full_name, u.system_role, u.status,
			u.role_id,
			COALESCE(ro.code, '') AS role_code,
			COALESCE(ro.name, '') AS role_name,
			u.last_login_at,
			u.created_at,
			u.updated_at
		FROM users u
		LEFT JOIN roles ro ON u.role_id = ro.id
		%s
		ORDER BY u.created_at DESC;
	`, whereClause)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("error querying users: %w", err)
	}
	defer rows.Close()

	var users []domain.UserResponse
	for rows.Next() {
		var u domain.UserResponse
		var roleID sql.NullString
		var lastLogin sql.NullTime
		if err := rows.Scan(
			&u.ID, &u.Email, &u.FullName, &u.SystemRole, &u.Status,
			&roleID,
			&u.RoleCode, &u.RoleName,
			&lastLogin,
			&u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if roleID.Valid {
			val := roleID.String
			u.RoleID = &val
		}
		if lastLogin.Valid {
			t := lastLogin.Time
			u.LastLoginAt = &t
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *UserRepository) CreateUser(ctx context.Context, req domain.CreateUserRequest, passwordHash string) (*domain.UserResponse, error) {
	query := `
		INSERT INTO users (email, full_name, password_hash, role_id, system_role, status, created_at, updated_at)
		VALUES (LOWER($1), $2, $3, $4, $5, $6, NOW(), NOW())
		RETURNING id;
	`
	var id string
	err := r.db.QueryRowContext(ctx, query,
		strings.TrimSpace(req.Email),
		strings.TrimSpace(req.FullName),
		passwordHash,
		req.RoleID,
		req.SystemRole,
		req.Status,
	).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("error creating user: %w", err)
	}

	user, err := r.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	resp := user.ToResponse()
	return &resp, nil
}

func (r *UserRepository) UpdateUser(ctx context.Context, id string, req domain.UpdateUserRequest) (*domain.UserResponse, error) {
	query := `
		UPDATE users
		SET 
			email = LOWER($1),
			full_name = $2,
			role_id = $3,
			system_role = $4,
			status = $5,
			updated_at = NOW()
		WHERE id = $6 AND deleted_at IS NULL;
	`
	res, err := r.db.ExecContext(ctx, query,
		strings.TrimSpace(req.Email),
		strings.TrimSpace(req.FullName),
		req.RoleID,
		req.SystemRole,
		req.Status,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("error updating user: %w", err)
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		return nil, ErrUserNotFound
	}

	user, err := r.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	resp := user.ToResponse()
	return &resp, nil
}

func (r *UserRepository) UpdateUserStatus(ctx context.Context, id string, status domain.UserStatus) error {
	query := `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL;`
	res, err := r.db.ExecContext(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("error updating user status: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id string, passwordHash string) error {
	query := `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL;`
	res, err := r.db.ExecContext(ctx, query, passwordHash, id)
	if err != nil {
		return fmt.Errorf("error updating password: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *UserRepository) DeleteUser(ctx context.Context, id string) error {
	query := `UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL;`
	res, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("error deleting user: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *UserRepository) GetStats(ctx context.Context) (*domain.UserStats, error) {
	var stats domain.UserStats
	query := `
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'ACTIVE'),
			COUNT(*) FILTER (WHERE status = 'DISABLED'),
			COUNT(*) FILTER (WHERE system_role = 'SYS_ADMIN')
		FROM users
		WHERE deleted_at IS NULL;
	`
	err := r.db.QueryRowContext(ctx, query).Scan(
		&stats.TotalUsers,
		&stats.ActiveUsers,
		&stats.DisabledUsers,
		&stats.SysAdminUsers,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying user counts: %w", err)
	}

	err = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM roles;`).Scan(&stats.TotalRoles)
	if err != nil {
		return nil, fmt.Errorf("error querying role count: %w", err)
	}

	return &stats, nil
}
