"""
routes/students.py
-------------------
CRUD for students + face enrollment.

Enrollment accepts multiple uploaded images in one request, detects a face
in each, extracts embeddings, and stores them — this is the API equivalent
of running enroll.py, but per-student and on demand from the UI.
"""

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List

from database import db
from utils.face_utils import get_faces, l2_normalize
from utils.security import get_current_admin

router = APIRouter(prefix="/api/students", tags=["students"])


class StudentIn(BaseModel):
    student_id: str
    name: str
    roll_no: Optional[str] = ""
    department: Optional[str] = ""
    year: Optional[str] = ""
    semester: Optional[int] = 1
    email: Optional[str] = ""
    phone: Optional[str] = ""


@router.get("")
def list_students(admin: str = Depends(get_current_admin)):
    return db.get_all_students()


@router.get("/{student_id}")
def get_student(student_id: str, admin: str = Depends(get_current_admin)):
    student = db.get_student(student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    return student


@router.post("")
def create_student(payload: StudentIn, admin: str = Depends(get_current_admin)):
    if db.get_student(payload.student_id):
        raise HTTPException(400, "student_id already exists")
    db.upsert_student(**payload.model_dump())
    db.log_event("student_created", payload.student_id)
    return {"message": "Student created", "student_id": payload.student_id}


@router.put("/{student_id}")
def update_student(student_id: str, payload: StudentIn, admin: str = Depends(get_current_admin)):
    if not db.get_student(student_id):
        raise HTTPException(404, "Student not found")
    data = payload.model_dump()
    data["student_id"] = student_id
    db.upsert_student(**data)
    return {"message": "Student updated"}


@router.delete("/{student_id}")
def remove_student(student_id: str, admin: str = Depends(get_current_admin)):
    if not db.get_student(student_id):
        raise HTTPException(404, "Student not found")
    db.delete_student(student_id)
    db.log_event("student_deleted", student_id)
    return {"message": "Student deleted"}


@router.post("/{student_id}/enroll")
async def enroll_face(student_id: str, files: List[UploadFile] = File(...),
                       admin: str = Depends(get_current_admin)):
    """
    Accepts multiple image files (5-10 recommended), extracts one embedding
    per photo, replaces any existing embeddings for this student.
    """
    student = db.get_student(student_id)
    if not student:
        raise HTTPException(404, "Student not found — create the student before enrolling")

    db.clear_embeddings_for_student(student_id)
    added, skipped = 0, []

    for f in files:
        contents = await f.read()
        arr = np.frombuffer(contents, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            skipped.append(f.filename); continue

        faces = get_faces(frame)
        if not faces:
            skipped.append(f.filename); continue
        if len(faces) > 1:
            faces.sort(key=lambda fc: (fc.bbox[2]-fc.bbox[0])*(fc.bbox[3]-fc.bbox[1]), reverse=True)

        vec = l2_normalize(faces[0].embedding.astype(np.float32))
        db.add_embedding(student_id, vec, source=f.filename)
        added += 1

    if added == 0:
        raise HTTPException(400, "No usable faces found in the uploaded images")

    db.log_event("face_enrolled", f"{student_id}: {added} images")
    return {"message": "Registration successful", "images_enrolled": added, "skipped": skipped}
