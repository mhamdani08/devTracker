package domain

import "time"

type GeneralParameter struct {
	ID            string    `json:"id"`
	ParameterType string    `json:"parameter_type"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	SortOrder     int       `json:"sort_order"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type CreateParameterRequest struct {
	ParameterType string `json:"parameter_type"`
	Code          string `json:"code"`
	Name          string `json:"name"`
	SortOrder     int    `json:"sort_order"`
	IsActive      *bool  `json:"is_active"`
}

type UpdateParameterRequest struct {
	Name      string `json:"name"`
	SortOrder int    `json:"sort_order"`
	IsActive  *bool  `json:"is_active"`
}

type ParameterTypeSummary struct {
	ParameterType string `json:"parameter_type"`
	Count         int    `json:"count"`
	ActiveCount   int    `json:"active_count"`
}
