"""
routes/reports.py
------------------
Aggregate endpoints the dashboard/analytics pages call directly, so the
frontend doesn't have to recompute stats from raw attendance rows itself.
"""

from datetime import date, timedelta
from fastapi import APIRouter, Depends

from database import db
from utils.security import get_current_admin

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/summary")
def dashboard_summary(admin: str = Depends(get_current_admin)):
    students = db.get_all_students()
    today_rows = db.get_attendance_for_date(date.today().isoformat())
    present_ids = {r["student_id"] for r in today_rows}

    total = len(students)
    present = len(present_ids)
    absent = max(total - present, 0)
    pct = round((present / total) * 100, 1) if total else 0.0

    return {
        "total_students": total,
        "present_today": present,
        "absent_today": absent,
        "attendance_percentage": pct,
    }


@router.get("/trend")
def attendance_trend(days: int = 7, admin: str = Depends(get_current_admin)):
    students = db.get_all_students()
    total = len(students)
    end = date.today()
    start = end - timedelta(days=days - 1)
    rows = db.get_attendance_range(start.isoformat(), end.isoformat())

    by_date = {}
    for r in rows:
        by_date.setdefault(r["date"], set()).add(r["student_id"])

    out = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        present = len(by_date.get(d, set()))
        out.append({"date": d, "present": present, "absent": max(total - present, 0)})
    return out


@router.get("/department")
def department_breakdown(admin: str = Depends(get_current_admin)):
    students = db.get_all_students()
    end = date.today()
    start = end - timedelta(days=29)
    rows = db.get_attendance_range(start.isoformat(), end.isoformat())

    depts = {}
    for s in students:
        depts.setdefault(s["department"], {"students": 0, "marks": 0})
        depts[s["department"]]["students"] += 1
    for r in rows:
        if r["department"] in depts:
            depts[r["department"]]["marks"] += 1

    out = []
    for dept, v in depts.items():
        possible = v["students"] * 30
        rate = round((v["marks"] / possible) * 100, 1) if possible else 0.0
        out.append({"department": dept, "attendance_rate": rate})
    return out
