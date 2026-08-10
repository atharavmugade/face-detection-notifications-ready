"""
Notification helpers.

Website notifications are stored in SQLite.
WhatsApp notifications use the official Meta WhatsApp Cloud API when the
following environment variables are configured:
  WHATSAPP_ACCESS_TOKEN
  WHATSAPP_PHONE_NUMBER_ID
  WHATSAPP_TEMPLATE_NAME
  WHATSAPP_TEMPLATE_LANG (optional, defaults to en_US)

The template should contain four body variables in this order:
1 student name, 2 roll no, 3 date, 4 time.
"""
import os
import requests

from database import db


def build_attendance_message(student, day, time):
    return (
        "✅ Attendance Marked\n\n"
        f"👤 Student: {student['name']}\n"
        f"🎓 Roll No: {student.get('roll_no') or '-'}\n"
        f"📅 Date: {day}\n"
        f"🕒 Time: {time}\n\n"
        "📌 Status: Present"
    )


def create_website_notification(student, day, time):
    message = build_attendance_message(student, day, time)
    return db.create_notification(
        student["student_id"],
        "Attendance Marked",
        message,
        "website",
    )


def send_whatsapp_attendance(student, day, time):
    phone = (student.get("phone") or "").strip()
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip()
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    template_name = os.getenv("WHATSAPP_TEMPLATE_NAME", "").strip()
    template_lang = os.getenv("WHATSAPP_TEMPLATE_LANG", "en_US").strip()
    graph_version = os.getenv("WHATSAPP_GRAPH_VERSION", "v23.0").strip()

    if not phone or not token or not phone_number_id or not template_name:
        return {
            "sent": False,
            "reason": "WhatsApp is not configured or student phone is missing",
        }

    # Meta expects an international number without +, spaces or punctuation.
    recipient = "".join(ch for ch in phone if ch.isdigit())
    if not recipient:
        return {"sent": False, "reason": "Invalid student phone number"}

    url = f"https://graph.facebook.com/{graph_version}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": template_lang},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": str(student["name"])},
                        {"type": "text", "text": str(student.get("roll_no") or "-")},
                        {"type": "text", "text": str(day)},
                        {"type": "text", "text": str(time)},
                    ],
                }
            ],
        },
    }

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
        if response.ok:
            db.create_notification(
                student["student_id"],
                "WhatsApp sent",
                build_attendance_message(student, day, time),
                "whatsapp",
            )
            return {"sent": True}

        return {
            "sent": False,
            "reason": f"WhatsApp API error {response.status_code}: {response.text[:300]}",
        }
    except requests.RequestException as exc:
        return {"sent": False, "reason": f"WhatsApp request failed: {exc}"}


def notify_attendance(student, day, time):
    website_id = create_website_notification(student, day, time)
    whatsapp = send_whatsapp_attendance(student, day, time)
    return {"website_notification_id": website_id, "whatsapp": whatsapp}
