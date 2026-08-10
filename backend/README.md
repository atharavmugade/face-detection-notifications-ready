# Verify — Backend (FastAPI + InsightFace)

## Folder structure
```
backend/
├── app.py                  # FastAPI entrypoint, wires all routers, loads model once
├── requirements.txt
├── database/
│   └── db.py                # SQLite: students, embeddings, attendance, admin, settings, logs
├── routes/
│   ├── auth.py               # POST /api/auth/login, /api/auth/seed
│   ├── students.py           # CRUD + POST /api/students/{id}/enroll
│   ├── attendance.py         # today/week/month/range, delete, CSV export
│   ├── recognition.py        # POST /api/recognize — the live camera endpoint
│   ├── settings.py           # GET/PUT recognition threshold
│   └── reports.py            # dashboard summary, trend, department breakdown
└── utils/
    ├── security.py            # JWT + bcrypt password hashing
    └── face_utils.py          # InsightFace detection + embedding + matching
```

## 1. Install

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Create the first admin account (one-time)

Start the server first:
```bash
uvicorn app:app --reload --port 8000
```

Then in another terminal:
```bash
curl -X POST http://localhost:8000/api/auth/seed \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@campus.edu","password":"yourpassword"}'
```

**Remove or protect the `/api/auth/seed` route before any real deployment** — it currently has no auth guard since it's only meant to bootstrap the very first admin locally.

## 3. Log in and get a token

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -F "username=admin@campus.edu" -F "password=yourpassword"
```
Returns `{"access_token": "...", "token_type": "bearer"}`. Every other
endpoint requires this token in the header:
```
Authorization: Bearer <access_token>
```

## 4. Add a student and enroll their face

```bash
curl -X POST http://localhost:8000/api/students \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"student_id":"S001","name":"Aarav Mehta","roll_no":"CSE-22-014","department":"CSE","year":"2nd Year"}'

curl -X POST http://localhost:8000/api/students/S001/enroll \
  -H "Authorization: Bearer <token>" \
  -F "files=@photo1.jpg" -F "files=@photo2.jpg" -F "files=@photo3.jpg"
```

## 5. Recognize a live frame

The frontend's Live Attendance page should capture a frame from the
browser `<video>` element onto a `<canvas>`, export it as a JPEG blob,
and POST it here every 1-2 seconds while auto-scan is active:

```js
const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.85));
const form = new FormData();
form.append("file", blob, "frame.jpg");
const res = await fetch("http://localhost:8000/api/recognize", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const data = await res.json();
// data.faces = [{ status: "marked" | "already_marked" | "unknown", name, similarity, bbox }, ...]
```

## 6. Connecting the React frontend

The `AttendanceApp.jsx` artifact currently runs on simulated/mock
recognition so it works standalone with no backend. To wire it to this
real API:
- Replace the mock `runScan()` logic in the Attendance page with the
  fetch call shown above (capture a canvas frame → POST to `/api/recognize`)
- Replace `useState(SEED_STUDENTS)` / `useState(SEED_ATTENDANCE)` with data
  fetched from `/api/students` and `/api/attendance/today` on load
- Store the JWT from `/api/auth/login` (e.g. in memory or `sessionStorage`
  outside of any artifact context) and attach it to every request

## What's stubbed vs. real here

**Fully real and working once you run it:**
- Auth (JWT + bcrypt), student CRUD, face enrollment, live recognition,
  attendance marking with the one-per-day constraint, CSV export,
  configurable threshold, dashboard/analytics aggregate endpoints.

**Not built yet (noted as future work in the original spec too):**
- PDF/Excel export (CSV is implemented; add `openpyxl` for Excel,
  `reportlab` or `weasyprint` for PDF)
- Rate limiting, refresh tokens, role-based access (Admin/Teacher)
- Liveness/anti-spoofing detection
- React Native mobile app
- Deployment configs (Docker, Vercel/Render env setup)

These are all reasonable "Phase 2" additions once the core loop
(enroll → recognize → mark → report) is working end-to-end.
