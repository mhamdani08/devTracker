package domain

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type SystemRole string

const (
	SystemRoleSysAdmin SystemRole = "SYS_ADMIN"
	SystemRoleUser     SystemRole = "USER"
)

type UserStatus string

const (
	UserStatusInvited  UserStatus = "INVITED"
	UserStatusActive   UserStatus = "ACTIVE"
	UserStatusDisabled UserStatus = "DISABLED"
)

type Role struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type User struct {
	ID           string     `json:"id"`
	RoleID       *string    `json:"role_id,omitempty"`
	RoleCode     string     `json:"role_code,omitempty"`
	RoleName     string     `json:"role_name,omitempty"`
	Email        string     `json:"email"`
	FullName     string     `json:"full_name"`
	PasswordHash string     `json:"-"`
	SystemRole   SystemRole `json:"system_role"`
	Status       UserStatus `json:"status"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty"`
}

type UserResponse struct {
	ID          string     `json:"id"`
	Email       string     `json:"email"`
	FullName    string     `json:"full_name"`
	SystemRole  SystemRole `json:"system_role"`
	Status      UserStatus `json:"status"`
	RoleID      *string    `json:"role_id,omitempty"`
	RoleCode    string     `json:"role_code,omitempty"`
	RoleName    string     `json:"role_name,omitempty"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		FullName:    u.FullName,
		SystemRole:  u.SystemRole,
		Status:      u.Status,
		RoleID:      u.RoleID,
		RoleCode:    u.RoleCode,
		RoleName:    u.RoleName,
		LastLoginAt: u.LastLoginAt,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token     string       `json:"token"`
	ExpiresAt time.Time    `json:"expires_at"`
	User      UserResponse `json:"user"`
}

type JWTClaims struct {
	UserID     string     `json:"user_id"`
	Email      string     `json:"email"`
	FullName   string     `json:"full_name"`
	SystemRole SystemRole `json:"system_role"`
	RoleCode   string     `json:"role_code,omitempty"`
	RoleName   string     `json:"role_name,omitempty"`
	jwt.RegisteredClaims
}

type CreateUserRequest struct {
	Email      string     `json:"email"`
	FullName   string     `json:"full_name"`
	Password   string     `json:"password"`
	RoleID     *string    `json:"role_id"`
	SystemRole SystemRole `json:"system_role"`
	Status     UserStatus `json:"status"`
}

type UpdateUserRequest struct {
	Email      string     `json:"email"`
	FullName   string     `json:"full_name"`
	RoleID     *string    `json:"role_id"`
	SystemRole SystemRole `json:"system_role"`
	Status     UserStatus `json:"status"`
}

type ResetPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

type UpdateUserStatusRequest struct {
	Status UserStatus `json:"status"`
}

type UserFilter struct {
	Search          string
	RoleID          string
	SystemRole      string
	Status          string
	IncludeInactive bool
}

type UserStats struct {
	TotalUsers    int `json:"total_users"`
	ActiveUsers   int `json:"active_users"`
	DisabledUsers int `json:"disabled_users"`
	SysAdminUsers int `json:"sysadmin_users"`
	TotalRoles    int `json:"total_roles"`
}
