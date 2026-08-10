"""
routes/settings.py
-------------------
Read/update the configurable recognition threshold and margin, which
utils/face_utils.py reads at match time — so changes take effect
immediately without restarting the server.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import db
from utils.security import get_current_admin

router = APIRouter(prefix="/api/settings", tags=["settings"])


class ThresholdUpdate(BaseModel):
    match_threshold: float
    match_margin: float = 0.05


@router.get("")
def get_settings(admin: str = Depends(get_current_admin)):
    return {
        "match_threshold": float(db.get_setting("match_threshold", "0.38")),
        "match_margin": float(db.get_setting("match_margin", "0.05")),
    }


@router.put("")
def update_settings(payload: ThresholdUpdate, admin: str = Depends(get_current_admin)):
    db.set_setting("match_threshold", payload.match_threshold)
    db.set_setting("match_margin", payload.match_margin)
    db.log_event("settings_updated", str(payload.model_dump()))
    return {"message": "Settings updated"}
