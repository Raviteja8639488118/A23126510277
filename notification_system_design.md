# Stage 1 — Notification System Design (REST API + Real-time)

## 1. Core Requirements
- User notifications after login
- Real-time delivery using WebSockets / SSE
- CRUD operations on notifications
- Mark as read/unread
- Notification types support

---

## 2. Notification Types
- INFO
- SUCCESS
- WARNING
- ERROR

---

## 3. Notification Data Model

Notification {
  id: string,
  userId: string,
  title: string,
  message: string,
  type: INFO | SUCCESS | WARNING | ERROR,
  status: READ | UNREAD,
  createdAt: string,
  updatedAt: string,
  metadata: {
    source?: string,
    actionUrl?: string
  }
}

---

## 4. REST API Endpoints

### Create Notification
POST /api/v1/notifications

Request:
{
  "userId": "u123",
  "title": "Login Alert",
  "message": "New login detected",
  "type": "INFO"
}

---

### Get Notifications
GET /api/v1/notifications?userId=u123&status=UNREAD&page=1

---

### Mark as Read
PATCH /api/v1/notifications/{id}/read

---

### Mark All as Read
PATCH /api/v1/notifications/read-all

---

### Delete Notification
DELETE /api/v1/notifications/{id}

---

## 5. Headers
Authorization: Bearer <token>
Content-Type: application/json

---

## 6. Real-Time Design (WebSocket)

wss://api.example.com/ws/notifications?userId=u123

Event:
{
  "event": "NEW_NOTIFICATION",
  "data": {
    "id": "n1",
    "title": "Payment Received",
    "message": "₹500 credited"
  }
}

---

## 7. Flow
DB → Save Notification → Publish Event → WebSocket Push → UI Update

---

## 8. Key Points
- Use pagination
- Always store in DB (source of truth)
- Real-time via WebSocket or Redis pub-sub
