package handlers

import (
	"net/http"

	"dopkanji-backend/internal/httpx"
)

func Health(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
