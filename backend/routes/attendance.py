"""
routes/attendance.py
---------------------
Read attendance (today / range), delete a record, export as CSV.
Recognition itself (marking attendance) lives in routes/recognition.py.
"""

import csv
import io
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from database import db
from utils.security import get_current_admin

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.get("/today")
def today_attendance(admin: str = Depends(get_current_admin)):
    return db.get_attendance_for_date(date.today().isoformat())


@router.get("/range")
def range_attendance(start: str = Query(...), end: str = Query(...),
                      admin: str = Depends(get_current_admin)):
    return db.get_attendance_range(start, end)


@router.get("/week")
def week_attendance(admin: str = Depends(get_current_admin)):
    end = date.today()
    start = end - timedelta(days=6)
    return db.get_attendance_range(start.isoformat(), end.isoformat())


@router.get("/month")
def month_attendance(admin: str = Depends(get_current_admin)):
    end = date.today()
    start = end - timedelta(days=29)
    return db.get_attendance_range(start.isoformat(), end.isoformat())


@router.delete("/{record_id}")
def delete_record(record_id: int, admin: str = Depends(get_current_admin)):
    db.delete_attendance(record_id)
    db.log_event("attendance_deleted", str(record_id))
    return {"message": "Attendance record deleted"}


@router.get("/export")
def export_csv(start: str = Query(...), end: str = Query(...),
                admin: str = Depends(get_current_admin)):
    rows = db.get_attendance_range(start, end)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["student_id", "name", "roll_no", "department", "date", "time", "similarity"])
    for r in rows:
        writer.writerow([r["student_id"], r["name"], r["roll_no"], r["department"],
                          r["date"], r["time"], r["similarity"]])
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_{start}_to_{end}.csv"},
    )
