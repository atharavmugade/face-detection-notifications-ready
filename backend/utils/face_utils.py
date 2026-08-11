import numpy as np
import os
from insightface.app import FaceAnalysis
from database import db

DET_SIZE = (320, 320)
MIN_DET_SCORE = 0.30

_app = None


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


def l2_normalize(vec: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vec)
    return vec if norm == 0 else vec / norm


def get_faces(frame_bgr):
    app = get_face_app()
    faces = app.get(frame_bgr)
    return [f for f in faces if f.det_score >= MIN_DET_SCORE]


def match_embedding(query_vec, db_ids, db_matrix):
    threshold = float(db.get_setting("match_threshold", "0.38"))
    margin_required = float(db.get_setting("match_margin", "0.05"))

    if db_matrix.shape[0] == 0:
        return {
            "matched": False,
            "student_id": None,
            "similarity": 0.0,
            "margin": 0.0
        }

    q = l2_normalize(query_vec.astype(np.float32))
    sims = db_matrix @ q

    best_idx = int(np.argmax(sims))
    best_score = float(sims[best_idx])

    second_best = (
        float(np.partition(sims, -2)[-2])
        if sims.shape[0] > 1 else -1.0
    )

    margin = best_score - second_best
    matched = (
        best_score >= threshold
        and margin >= margin_required
    )

    return {
        "matched": matched,
        "student_id": db_ids[best_idx] if matched else None,
        "similarity": round(best_score, 4),
        "margin": round(margin, 4),
    }
