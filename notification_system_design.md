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


---

# Stage 2: Persistent Storage Design & Scaling

This section covers the choice of database, schema structure, data scaling strategy, and matching database queries for the API endpoints built in Stage 1.

---

## 1. Database Choice & Justification
For this notification system, **PostgreSQL (SQL)** is recommended as the primary persistent storage, supplemented by **Redis** for hot caching.

### Why PostgreSQL?
* **Structured Data & Relations:** Notifications are tied directly to an authenticated user (`user_id`). A relational DB naturally enforces data integrity through Foreign Keys.
* **Efficient Indexing:** Notifications are heavily read-optimized with pagination (e.g., retrieving the latest 20 unread items). PostgreSQL allows fast execution using multi-column B-Tree indexes.
* **ACID Compliance:** Operations like marking all items as read or deleting notifications require transactional guarantees to prevent desynchronization across multiple client tabs.

---

## 2. Database Schema (PostgreSQL)

```sql
CREATE TYPE notification_type AS ENUM ('security', 'info', 'chat', 'marketing');
CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type notification_type DEFAULT 'info',
    priority notification_priority DEFAULT 'low',
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Optimization Indexes
CREATE INDEX idx_notifications_user_read_date 
ON notifications (user_id, is_read, created_at DESC);

4. DB Queries Matching Stage 1 APIs
A. Fetch Notifications (Paginated & Filtered)
Fetches page 1 (limit 20) of unread notifications for a specific user.

SQL
SELECT id, title, message, type, priority, is_read, created_at 
FROM notifications
WHERE user_id = 'usr_12345' AND is_read = FALSE
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
B. Mark a Single Notification as Read
SQL
UPDATE notifications
SET is_read = TRUE, updated_at = NOW()
WHERE id = 'notif_883f12a9-c702-4b20' AND user_id = 'usr_12345'
RETURNING id, is_read, updated_at;
C. Mark All Notifications as Read
SQL
UPDATE notifications
SET is_read = TRUE, updated_at = NOW()
WHERE user_id = 'usr_12345' AND is_read = FALSE;
D. Delete a Notification
SQL
DELETE FROM notifications
WHERE id = 'notif_883f12a9-c702-4b20' AND user_id = 'usr_12345';




---

# Stage 3: Query Optimization & Performance Analysis

This section analyzes a slow production query, addresses index design strategies, and implements a targeted reporting query based on the requirements in image_d73a3f.jpg.

---

## 1. Analysis of the Existing Query

### Is the query accurate?
Yes, functionally the query is accurate. It accurately filters by a specific student ID, targets unread states (`isRead = false`), and sorts them chronologically (`createdAt ASC`).

### Why is this query slow?
With 5,000,000 notifications in the database, the query has slowed down because:
1. **Full Table Scan:** Without a proper composite index, the database engine has to scan millions of rows to find matching items for a single student.
2. **On-the-Fly Sorting Cost:** The database is forced to sort the resulting rows in memory or disk via an explicit sort operation to satisfy `ORDER BY createdAt ASC`.
3. **Select Star (`SELECT *`):** Retrieving all columns (including potentially large text payloads in the `message` field) increases I/O overhead and network transfer times.

### What should change and what is the computation cost?
* **The Change:** Create a **Composite B-Tree Index** matching the exact filtering and sorting path:
```sql
  CREATE INDEX idx_notifications_student_unread_date 
  ON notifications (studentID, isRead, createdAt ASC);



  SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL '7 days';