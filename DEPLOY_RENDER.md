# Render deployment

This repository is split into two Render services:

- `verify-attendance-api` — FastAPI + InsightFace backend
- `verify-attendance-frontend` — Vite/React static site

## Recommended deployment

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository. Render will read `render.yaml`.
3. Deploy the backend first. Wait for its URL, for example:
   `https://verify-attendance-api.onrender.com`
4. Create/deploy the frontend. In the frontend service environment variables set:
   `VITE_API_BASE=https://verify-attendance-api.onrender.com`
5. Copy the frontend URL into the backend `ALLOWED_ORIGINS`, e.g.:
   `https://verify-attendance-frontend.onrender.com`
6. Redeploy the backend after saving the CORS variable.
7. Open:
   `https://verify-attendance-api.onrender.com/api/health`
   It should return `{"status":"ok"}`.
8. Open the frontend URL and log in.

## First admin

The current `/api/auth/seed` endpoint is intended only for first-time bootstrap. After deployment, call it once with your chosen admin email/password, then remove/disable that route before exposing the app publicly.

## WhatsApp

Set these backend environment variables in Render:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANG`
- `WHATSAPP_GRAPH_VERSION`

The Meta template must be approved and match the four body variables used by the app.

## Important hosting note

The app uses SQLite for students, face embeddings and attendance. The Blueprint attaches a persistent disk at `/data` and points `DB_PATH` there. Do not remove the disk if you need the data to survive redeploys/restarts.

InsightFace is configured for CPU (`INSIGHTFACE_CTX_ID=-1`) because Render does not provide a GPU to this service. `buffalo_l` is computationally heavy, so use a sufficiently sized Render instance for live recognition.
