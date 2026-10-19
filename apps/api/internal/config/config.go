package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	AppEnv             string
	HTTPAddr           string
	DatabaseURL        string
	JWTSecret          string
	JWTExpirationHours int
	CORSAllowedOrigins []string
}

func LoadConfig() Config {
	httpAddr := os.Getenv("HTTP_ADDR")
	if httpAddr == "" {
		httpAddr = ":8080"
	}

	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "development"
	}

	databaseURL := os.Getenv("DATABASE_URL")

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "devtracker_default_secret_key_change_in_production"
	}

	jwtExpHours := 24
	if expStr := os.Getenv("JWT_EXPIRATION_HOURS"); expStr != "" {
		if exp, err := strconv.Atoi(expStr); err == nil && exp > 0 {
			jwtExpHours = exp
		}
	}

	corsEnv := os.Getenv("CORS_ALLOWED_ORIGINS")
	var corsOrigins []string
	if corsEnv != "" {
		for _, o := range strings.Split(corsEnv, ",") {
			corsOrigins = append(corsOrigins, strings.TrimSpace(o))
		}
	} else {
		corsOrigins = []string{"http://localhost:3000", "http://localhost:3002"}
	}

	return Config{
		AppEnv:             appEnv,
		HTTPAddr:           httpAddr,
		DatabaseURL:        databaseURL,
		JWTSecret:          jwtSecret,
		JWTExpirationHours: jwtExpHours,
		CORSAllowedOrigins: corsOrigins,
	}
}
