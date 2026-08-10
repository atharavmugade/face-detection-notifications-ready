from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional

from database import db
from utils.security import get_current_admin

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class MarkReadIn(BaseModel):
    notification_ids: Optional[List[int]] = None


@router.get("")
def list_notifications(limit: int = 50, admin: str = Depends(get_current_admin)):
    limit = max(1, min(limit, 100))
    return db.get_notifications(limit)


@router.post("/read")
def mark_read(payload: MarkReadIn, admin: str = Depends(get_current_admin)):
    db.mark_notifications_read(payload.notification_ids)
    return {"message": "Notifications marked as read"}
