# Attendance notification setup

## What was added

When face recognition marks a student present for the first time that day:

1. A website notification is stored in SQLite and appears in the dashboard bell.
2. A WhatsApp message is sent only to that student's `phone` field, when WhatsApp Cloud API credentials are configured.

The message content is:

✅ Attendance Marked

👤 Student: <name>
🎓 Roll No: <roll no>
📅 Date: <date>
🕒 Time: <time>

📌 Status: Present

## WhatsApp setup

The backend uses the official Meta WhatsApp Cloud API.

Create an approved WhatsApp message template named `attendance_marked` with four body variables:

`{{1}}` Student name
`{{2}}` Roll number
`{{3}}` Date
`{{4}}` Time

Copy `.env.example` to `.env` and fill:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANG`
- `WHATSAPP_GRAPH_VERSION`

The student's phone number must be saved in international format in the student record, e.g. `+919876543210`.

## Website notifications

The backend exposes:

- `GET /api/notifications?limit=50`
- `POST /api/notifications/read`

The frontend polls notifications every 5 seconds and shows them in the top-bar bell.

## Important

WhatsApp delivery is skipped safely if credentials or a student's phone number are missing. Attendance itself is not rolled back if WhatsApp fails.
