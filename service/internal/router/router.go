package router

import (
	"net/http"

	"dopkanji-backend/internal/handlers"
	"gorm.io/gorm"
)

func New(db *gorm.DB) http.Handler {
	mux := http.NewServeMux()
	userHandler := handlers.UserHandler{DB: db}

	mux.HandleFunc("/health", handlers.Health)
	mux.HandleFunc("/users", userHandler.Users)

	return mux
}
