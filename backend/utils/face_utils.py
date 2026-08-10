import os
import numpy as np
from insightface.app import FaceAnalysis
from database import db


# ---------------------------------------------------------
# Render / CPU friendly settings
# ---------------------------------------------------------

DET_SIZE = (320, 320)
MIN_DET_SCORE = 0.55

_app = None


# ---------------------------------------------------------
# Load InsightFace model
# ---------------------------------------------------------

def get_face_app():
    global _app

    if _app is None:
        model_name = os.getenv("INSIGHTFACE_MODEL", "buffalo_l")
        ctx_id = int(os.getenv("INSIGHTFACE_CTX_ID", "-1"))

        _app = FaceAnalysis(name=model_name)

        _app.prepare(
            ctx_id=ctx_id,
            det_size=DET_SIZE
        )

    return _app


# ---------------------------------------------------------
# Get face embedding
# ---------------------------------------------------------

def get_embedding(image):
    app = get_face_app()

    faces = app.get(image)

    if not faces:
        return None

    # Select the largest detected face
    face = max(
        faces,
        key=lambda f: (f.bbox[2] - f.bbox[0]) *
                      (f.bbox[3] - f.bbox[1])
    )

    if face.det_score < MIN_DET_SCORE:
        return None

    embedding = face.embedding

    if embedding is None:
        return None

    embedding = np.asarray(embedding, dtype=np.float32)

    # Normalize embedding
    norm = np.linalg.norm(embedding)

    if norm == 0:
        return None

    embedding = embedding / norm

    return embedding


# ---------------------------------------------------------
# Compare two embeddings
# ---------------------------------------------------------

def cosine_similarity(embedding1, embedding2):

    embedding1 = np.asarray(
        embedding1,
        dtype=np.float32
    )

    embedding2 = np.asarray(
        embedding2,
        dtype=np.float32
    )

    norm1 = np.linalg.norm(embedding1)
    norm2 = np.linalg.norm(embedding2)

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return float(
        np.dot(embedding1, embedding2)
        / (norm1 * norm2)
    )


# ---------------------------------------------------------
# Find matching student
# ---------------------------------------------------------

def find_best_match(
    query_embedding,
    threshold=0.45
):

    students = db.get_all_students()

    best_student = None
    best_similarity = 0.0

    for student in students:

        stored_embedding = student.get("embedding")

        if stored_embedding is None:
            continue

        try:
            similarity = cosine_similarity(
                query_embedding,
                stored_embedding
            )
        except Exception:
            continue

        if similarity > best_similarity:
            best_similarity = similarity
            best_student = student

    if (
        best_student is not None
        and best_similarity >= threshold
    ):
        return best_student, best_similarity

    return None, best_similarity
