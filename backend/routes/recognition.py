"""
routes/recognition.py
----------------------
POST /api/recognize
    Accepts a single frame (image upload) from the browser's live camera,
    detects ALL faces in it, matches each against the enrolled embeddings,
    and marks attendance for any confident, not-yet-marked-today match.

This is the endpoint the frontend's "Live Attendance" page calls repeatedly
(e.g. every 1-2 seconds) while auto-scan is active. Embeddings are loaded
from the DB once per request here for simplicity — for higher frame rates,
cache db.load_all_embeddings() in memory and refresh it only when students
are added/edited (e.g. on a timer or a pub/sub signal).
"""

import cv2
import numpy as np
from datetime import date, datetime
from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File

from database import db
from utils.face_utils import get_faces, match_embedding
from utils.security import get_current_admin
from utils.notifications import notify_attendance

router = APIRouter(prefix="/api/recognize", tags=["recognition"])


@router.post("")
async def recognize_frame(background_tasks: BackgroundTasks, file: UploadFile = File(...), admin: str = Depends(get_current_admin)):
    contents = await file.read()
    arr = np.frombuffer(contents, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return {"faces": [], "error": "Could not decode image"}

    db_ids, db_matrix = db.load_all_embeddings()
    faces = get_faces(frame)

    results = []
    for face in faces:
        match = match_embedding(face.embedding, db_ids, db_matrix)
        bbox = [float(v) for v in face.bbox]

        if not match["matched"]:
            results.append({"status": "unknown", "similarity": match["similarity"], "bbox": bbox})
            continue

        student_id = match["student_id"]
        student = db.get_student(student_id)

        if db.already_marked_today(student_id):
            results.append({
                "status": "already_marked", "student_id": student_id,
                "name": student["name"], "similarity": match["similarity"], "bbox": bbox,
            })
            continue

        marked = db.mark_attendance(student_id, match["similarity"])
        db.log_event("attendance_marked", f"{student_id} sim={match['similarity']}")

        # Send only to the student whose face was recognized.
        if marked:
            day_for_message = date.today().isoformat()
            time_for_message = datetime.now().strftime("%H:%M:%S")
            background_tasks.add_task(
                notify_attendance,
                student,
                day_for_message,
                time_for_message,
            )

        results.append({
            "status": "marked", "student_id": student_id, "name": student["name"],
            "similarity": match["similarity"], "bbox": bbox,
        })

    return {"faces": results, "count": len(results)}
