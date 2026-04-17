package handlers

import (
	"encoding/json"
	"net/http"

	"dopkanji-backend/internal/httpx"
	"dopkanji-backend/internal/models"
	"gorm.io/gorm"
)

type UserHandler struct {
	DB *gorm.DB
}

func (h UserHandler) Users(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		var users []models.User
		if err := h.DB.Order("id DESC").Find(&users).Error; err != nil {
			httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		httpx.WriteJSON(w, http.StatusOK, users)
	case http.MethodPost:
		var in struct {
			Name  string `json:"name"`
			Email string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}
		if in.Email == "" {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
			return
		}

		user := models.User{Name: in.Name, Email: in.Email}
		if err := h.DB.Create(&user).Error; err != nil {
			httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		httpx.WriteJSON(w, http.StatusCreated, user)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}
