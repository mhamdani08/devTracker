package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/lib/pq"

	"github.com/devtracker/api/internal/config"
	"github.com/devtracker/api/internal/handler"
	"github.com/devtracker/api/internal/middleware"
	"github.com/devtracker/api/internal/repository"
	"github.com/devtracker/api/internal/service"
)

func corsMiddleware(allowedOrigins []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Max-Age", "86400")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func main() {
	cfg := config.LoadConfig()

	log.Printf("[API] Starting Developer Progress Tracker API...")
	log.Printf("[API] Environment: %s", cfg.AppEnv)
	log.Printf("[API] Server listening on %s", cfg.HTTPAddr)

	// Initialize Database Connection
	var db *sql.DB
	if cfg.DatabaseURL != "" {
		var err error
		db, err = sql.Open("postgres", cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("[API] Fatal: Failed to initialize PostgreSQL driver: %v", err)
		}
		db.SetMaxOpenConns(25)
		db.SetMaxIdleConns(5)
		db.SetConnMaxLifetime(5 * time.Minute)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			log.Printf("[API] Warning: Database ping failed on startup: %v (will retry on readiness check)", err)
		} else {
			log.Printf("[API] Database connected successfully.")
		}
	} else {
		log.Printf("[API] Warning: DATABASE_URL not set.")
	}

	// Initialize Repositories, Services & Handlers
	var userRepo *repository.UserRepository
	var authService *service.AuthService
	var authHandler *handler.AuthHandler

	var userService *service.UserService
	var userHandler *handler.UserHandler

	var parameterRepo *repository.ParameterRepository
	var parameterService *service.ParameterService
	var parameterHandler *handler.ParameterHandler

	var projectRepo *repository.ProjectRepository
	var projectService *service.ProjectService
	var projectHandler *handler.ProjectHandler

	var taskRepo *repository.TaskRepository
	var taskService *service.TaskService
	var taskHandler *handler.TaskHandler

	if db != nil {
		userRepo = repository.NewUserRepository(db)
		authService = service.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTExpirationHours)
		authHandler = handler.NewAuthHandler(authService)

		userService = service.NewUserService(userRepo)
		userHandler = handler.NewUserHandler(userService)

		parameterRepo = repository.NewParameterRepository(db)
		parameterService = service.NewParameterService(parameterRepo)
		parameterHandler = handler.NewParameterHandler(parameterService)

		projectRepo = repository.NewProjectRepository(db)
		projectService = service.NewProjectService(projectRepo, parameterRepo)

		taskRepo = repository.NewTaskRepository(db)
		taskService = service.NewTaskService(taskRepo, projectRepo, parameterRepo)
		taskHandler = handler.NewTaskHandler(taskService)

		projectHandler = handler.NewProjectHandler(projectService, taskHandler)
	}

	mux := http.NewServeMux()

	// 1. Health Checks
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"status":    "healthy",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"version":   "0.1.0",
		})
	})

	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		checks := map[string]string{
			"api": "ok",
		}
		ready := true

		if db == nil {
			checks["database"] = "unconfigured"
			ready = false
		} else {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := db.PingContext(ctx); err != nil {
				checks["database"] = fmt.Sprintf("error: %v", err)
				ready = false
			} else {
				checks["database"] = "connected"
			}
		}

		status := http.StatusOK
		if !ready {
			status = http.StatusServiceUnavailable
		}

		jsonResponse(w, status, map[string]interface{}{
			"ready":     ready,
			"checks":    checks,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// 2. API Status
	mux.HandleFunc("/api/v1/status", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"name":        "Developer Progress Tracker API",
			"version":     "v1",
			"environment": cfg.AppEnv,
			"status":      "running",
			"timestamp":   time.Now().UTC().Format(time.RFC3339),
		})
	})

	// 3. Auth Endpoints
	if authHandler != nil {
		// Login: POST /api/v1/auth/login
		mux.HandleFunc("/api/v1/auth/login", authHandler.Login)

		// Me (Protected): GET /api/v1/auth/me
		meProtected := middleware.AuthMiddleware(authService, http.HandlerFunc(authHandler.Me))
		mux.Handle("/api/v1/auth/me", meProtected)

		// Roles list: GET /api/v1/roles
		mux.HandleFunc("/api/v1/roles", authHandler.Roles)
	}

	// 3b. User Management Endpoints
	if userHandler != nil && authService != nil {
		// List & Create Users: /api/v1/users
		mux.Handle("/api/v1/users", middleware.AuthMiddleware(authService, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost {
				adminOnly := middleware.RequireSysAdmin(http.HandlerFunc(userHandler.HandleUsers))
				adminOnly.ServeHTTP(w, r)
				return
			}
			userHandler.HandleUsers(w, r)
		})))

		// User Subroutes: /api/v1/users/{id}, /api/v1/users/stats, /api/v1/users/{id}/status, etc.
		mux.Handle("/api/v1/users/", middleware.AuthMiddleware(authService, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Read-only GET for specific user ID is allowed for all authenticated users
			if r.Method != http.MethodGet {
				adminOnly := middleware.RequireSysAdmin(http.HandlerFunc(userHandler.HandleUserSubroutes))
				adminOnly.ServeHTTP(w, r)
				return
			}
			userHandler.HandleUserSubroutes(w, r)
		})))
	}

	// 4. General Parameters Endpoints
	if parameterHandler != nil && authService != nil {
		// Parameter types: GET /api/v1/parameters/types
		mux.HandleFunc("/api/v1/parameters/types", parameterHandler.HandleParameterTypes)

		// List & Create: GET (public/read), POST (Admin only)
		mux.Handle("/api/v1/parameters", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost {
				adminHandler := middleware.AuthMiddleware(authService, middleware.RequireSysAdmin(http.HandlerFunc(parameterHandler.HandleParameters)))
				adminHandler.ServeHTTP(w, r)
				return
			}
			parameterHandler.HandleParameters(w, r)
		}))

		// Parameter by ID & Toggle: /api/v1/parameters/{id} & /api/v1/parameters/{id}/toggle
		mux.Handle("/api/v1/parameters/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasSuffix(r.URL.Path, "/toggle") {
				adminHandler := middleware.AuthMiddleware(authService, middleware.RequireSysAdmin(http.HandlerFunc(parameterHandler.HandleToggleParameter)))
				adminHandler.ServeHTTP(w, r)
				return
			}

			if r.Method == http.MethodPut || r.Method == http.MethodPatch || r.Method == http.MethodDelete {
				adminHandler := middleware.AuthMiddleware(authService, middleware.RequireSysAdmin(http.HandlerFunc(parameterHandler.HandleParameterByID)))
				adminHandler.ServeHTTP(w, r)
				return
			}
			parameterHandler.HandleParameterByID(w, r)
		}))
	}

	// 5. Project Endpoints
	if projectHandler != nil && authService != nil {
		// List (GET) & Create (POST)
		mux.Handle("/api/v1/projects", middleware.AuthMiddleware(authService, http.HandlerFunc(projectHandler.HandleProjects)))

		// Project Stats: GET /api/v1/projects/stats
		mux.Handle("/api/v1/projects/stats", middleware.AuthMiddleware(authService, http.HandlerFunc(projectHandler.HandleStats)))

		// Project Detail & Sub-resources: /api/v1/projects/{id}...
		mux.Handle("/api/v1/projects/", middleware.AuthMiddleware(authService, http.HandlerFunc(projectHandler.HandleProjectSubroutes)))
	}

	// 6. Task Endpoints
	if taskHandler != nil && authService != nil {
		// Task Detail & Sub-resources: /api/v1/tasks/{id} and /api/v1/tasks/{id}/status
		mux.Handle("/api/v1/tasks/", middleware.AuthMiddleware(authService, http.HandlerFunc(taskHandler.HandleTaskSubroutes)))
	}

	handlerWithCORS := corsMiddleware(cfg.CORSAllowedOrigins, mux)

	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      handlerWithCORS,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[API] Listen error: %v", err)
		}
	}()

	fmt.Printf("[API] Server is listening at %s\n", cfg.HTTPAddr)
	<-stop

	log.Println("[API] Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if db != nil {
		_ = db.Close()
	}

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[API] Server forced shutdown: %v", err)
	}

	log.Println("[API] Server exited successfully.")
}
