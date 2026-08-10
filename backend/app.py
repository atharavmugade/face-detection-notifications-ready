"""
app.py
------
FastAPI application entrypoint. Wires together all routers, sets up CORS
for the React frontend, and loads the InsightFace model once at startup
(not per-request — loading it per-request would be extremely slow).

RUN:
    uvicorn app:app --reload --port 8000

The frontend (React dev server, typically on :5173 or :3000) needs CORS
allowed here — update ALLOWED_ORIGINS for your actual frontend URL.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from database import db
from routes import auth, students, attendance, recognition, settings, reports, notifications


_configured_origins = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in _configured_origins.split(",")
    if origin.strip()
] or [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    db.init_db()
    try:
        from utils.face_utils import get_face_app
        get_face_app()  # warm-load the InsightFace model once
        print("InsightFace model loaded.")
    except Exception as e:
        print(f"WARNING: could not preload InsightFace model at startup: {e}")
    yield
    # Shutdown (nothing to clean up currently)


app = FastAPI(title="Verify — Face Recognition Attendance API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(students.router)
app.include_router(attendance.router)
app.include_router(recognition.router)
app.include_router(settings.router)
app.include_router(reports.router)
app.include_router(notifications.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
