"""
database/db.py
--------------
SQLite schema and query functions for the whole system:
students, embeddings, attendance, admin, settings, logs.

Same design principle as before: this is the ONLY file that runs raw SQL.
Every route calls into these functions instead of touching sqlite3 directly.
"""

import sqlite3
import os
import numpy as np
from pathlib import Path
from datetime import datetime, date

DB_PATH = Path(os.getenv("DB_PATH", str(Path(__file__).resolve().parent / "attendance.db")))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS admin (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            email    TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS students (
            student_id TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            roll_no    TEXT,
            department TEXT,
            year       TEXT,
            semester   INTEGER,
            email      TEXT,
            phone      TEXT,
            created_at TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS embeddings (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            vector     BLOB NOT NULL,
            dim        INTEGER NOT NULL,
            source     TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            date       TEXT NOT NULL,
            time       TEXT NOT NULL,
            similarity REAL NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
        )
    """)
    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique
        ON attendance(student_id, date)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('match_threshold', '0.38')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('match_margin', '0.05')")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            event      TEXT NOT NULL,
            detail     TEXT,
            created_at TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            title      TEXT NOT NULL,
            message    TEXT NOT NULL,
            channel    TEXT NOT NULL DEFAULT 'website',
            is_read    INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()


def log_event(event: str, detail: str = ""):
    conn = get_conn()
    conn.execute("INSERT INTO logs (event, detail, created_at) VALUES (?, ?, ?)",
                 (event, detail, datetime.now().isoformat(timespec="seconds")))
    conn.commit()
    conn.close()


# ---------------- admin ----------------

def create_admin(email: str, password_hash: str):
    conn = get_conn()
    conn.execute("INSERT OR IGNORE INTO admin (email, password_hash, created_at) VALUES (?, ?, ?)",
                 (email, password_hash, datetime.now().isoformat(timespec="seconds")))
    conn.commit()
    conn.close()


def get_admin_by_email(email: str):
    conn = get_conn()
    row = conn.execute("SELECT * FROM admin WHERE email=?", (email,)).fetchone()
    conn.close()
    return dict(row) if row else None


# ---------------- students ----------------

def upsert_student(student_id, name, roll_no="", department="", year="", semester=1, email="", phone=""):
    conn = get_conn()
    conn.execute("""
        INSERT INTO students (student_id, name, roll_no, department, year, semester, email, phone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_id) DO UPDATE SET
            name=excluded.name, roll_no=excluded.roll_no, department=excluded.department,
            year=excluded.year, semester=excluded.semester, email=excluded.email, phone=excluded.phone
    """, (student_id, name, roll_no, department, year, semester, email, phone,
          datetime.now().isoformat(timespec="seconds")))
    conn.commit()
    conn.close()


def get_all_students():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM students ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_student(student_id):
    conn = get_conn()
    row = conn.execute("SELECT * FROM students WHERE student_id=?", (student_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_student(student_id):
    conn = get_conn()
    conn.execute("DELETE FROM students WHERE student_id=?", (student_id,))
    conn.commit()
    conn.close()


# ---------------- embeddings ----------------

def add_embedding(student_id, vector: np.ndarray, source=""):
    vector = np.asarray(vector, dtype=np.float32)
    conn = get_conn()
    conn.execute("INSERT INTO embeddings (student_id, vector, dim, source, created_at) VALUES (?, ?, ?, ?, ?)",
                 (student_id, vector.tobytes(), vector.shape[0], source, datetime.now().isoformat(timespec="seconds")))
    conn.commit()
    conn.close()


def load_all_embeddings():
    conn = get_conn()
    rows = conn.execute("SELECT student_id, vector, dim FROM embeddings").fetchall()
    conn.close()
    ids, vectors = [], []
    for r in rows:
        vec = np.frombuffer(r["vector"], dtype=np.float32).reshape(r["dim"])
        ids.append(r["student_id"])
        vectors.append(vec)
    if not vectors:
        return [], np.zeros((0, 512), dtype=np.float32)
    return ids, np.vstack(vectors)


def clear_embeddings_for_student(student_id):
    conn = get_conn()
    conn.execute("DELETE FROM embeddings WHERE student_id=?", (student_id,))
    conn.commit()
    conn.close()


# ---------------- attendance ----------------

def mark_attendance(student_id, similarity):
    today = date.today().isoformat()
    now = datetime.now().strftime("%H:%M:%S")
    conn = get_conn()
    try:
        conn.execute("INSERT INTO attendance (student_id, date, time, similarity) VALUES (?, ?, ?, ?)",
                     (student_id, today, now, similarity))
        conn.commit()
        inserted = True
    except sqlite3.IntegrityError:
        inserted = False
    conn.close()
    return inserted


def already_marked_today(student_id):
    today = date.today().isoformat()
    conn = get_conn()
    row = conn.execute("SELECT 1 FROM attendance WHERE student_id=? AND date=?", (student_id, today)).fetchone()
    conn.close()
    return row is not None


def get_attendance_for_date(day):
    conn = get_conn()
    rows = conn.execute("""
        SELECT a.student_id, s.name, s.roll_no, s.department, a.date, a.time, a.similarity
        FROM attendance a JOIN students s ON a.student_id = s.student_id
        WHERE a.date=? ORDER BY a.time DESC
    """, (day,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_attendance_range(start_date, end_date):
    conn = get_conn()
    rows = conn.execute("""
        SELECT a.student_id, s.name, s.roll_no, s.department, a.date, a.time, a.similarity
        FROM attendance a JOIN students s ON a.student_id = s.student_id
        WHERE a.date BETWEEN ? AND ? ORDER BY a.date, a.time
    """, (start_date, end_date)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_attendance(record_id):
    conn = get_conn()
    conn.execute("DELETE FROM attendance WHERE id=?", (record_id,))
    conn.commit()
    conn.close()



# ---------------- notifications ----------------

def create_notification(student_id, title, message, channel="website"):
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO notifications
           (student_id, title, message, channel, is_read, created_at)
           VALUES (?, ?, ?, ?, 0, ?)""",
        (student_id, title, message, channel, datetime.now().isoformat(timespec="seconds")),
    )
    conn.commit()
    notification_id = cur.lastrowid
    conn.close()
    return notification_id


def get_notifications(limit=50):
    conn = get_conn()
    rows = conn.execute(
        """SELECT n.id, n.student_id, s.name, s.roll_no, n.title, n.message,
                  n.channel, n.is_read, n.created_at
           FROM notifications n
           JOIN students s ON s.student_id = n.student_id
           ORDER BY n.id DESC LIMIT ?""",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def mark_notifications_read(notification_ids=None):
    conn = get_conn()
    if notification_ids:
        placeholders = ",".join("?" for _ in notification_ids)
        conn.execute(
            f"UPDATE notifications SET is_read=1 WHERE id IN ({placeholders})",
            tuple(notification_ids),
        )
    else:
        conn.execute("UPDATE notifications SET is_read=1")
    conn.commit()
    conn.close()


# ---------------- settings ----------------

def get_setting(key, default=None):
    conn = get_conn()
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def set_setting(key, value):
    conn = get_conn()
    conn.execute("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                 (key, str(value)))
    conn.commit()
    conn.close()
