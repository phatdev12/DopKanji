package main

import (
	"log"
	"net/http"

	"dopkanji-backend/internal/config"
	"dopkanji-backend/internal/database"
	"dopkanji-backend/internal/models"
	"dopkanji-backend/internal/router"
	_ "github.com/joho/godotenv/autoload"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DB)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}); err != nil {
		log.Fatalf("failed to auto migrate: %v", err)
	}

	addr := ":" + cfg.Port
	log.Printf("backend running on %s", addr)
	if err := http.ListenAndServe(addr, router.New(db)); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
