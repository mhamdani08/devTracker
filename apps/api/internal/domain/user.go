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
	RoleCode    string     `json:"role_code,omitempty"`
	RoleName    string     `json:"role_name,omitempty"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		FullName:    u.FullName,
		SystemRole:  u.SystemRole,
		Status:      u.Status,
		RoleCode:    u.RoleCode,
		RoleName:    u.RoleName,
		LastLoginAt: u.LastLoginAt,
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
