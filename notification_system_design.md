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



  ---

# Stage 4: High-Load Performance & Mitigation Strategies

This section analyzes options to prevent database exhaustion caused by reading notifications on every client page load, outlining clear strategies along with architectural tradeoffs.

---

## 1. Suggested Architectural Solutions

### Strategy A: Implement Distributed Caching (e.g., Redis Cache-Aside)
Instead of querying PostgreSQL on every page load, intercept the request using a fast in-memory cache layer (like Redis). 
* When a student requests notifications, check Redis first (**Cache Hit**). 
* If missing (**Cache Miss**), fetch from PostgreSQL, write the results back to Redis with a Time-to-Live (TTL), and return them.
* Invalidate or update the specific Redis key whenever a new notification is generated or marked as read.

### Strategy B: Transition to Event-Driven Real-Time Pushes (SSE/WebSockets)
Move away from stateless request-driven fetching entirely. 
* Fetch notifications from the database **only once** during the initial app bootstrap/login handshake.
* Maintain an open, stateful connection via **Server-Sent Events (SSE)** or **WebSockets**.
* When new alerts occur, push the individual event delta across the stream. The frontend updates its local memory state reactively without ever making another database request.

### Strategy C: Client-Side State Management & Local Storage Syncing
Store fetched notifications in the client-side global store (e.g., Redux, Pinia, or React Context) or inside browser storage (`localStorage` / `IndexedDB`). Combine this with an optimistic cache header setup like `ETag` or HTTP caching (`Cache-Control: private, max-age=60`) to stop redundant network roundtrips within short time windows.

---

## 2. Tradeoffs Comparison Matrix

| Mitigation Strategy | Pros / Performance Wins | Cons / Tradeoffs |
| :--- | :--- | :--- |
| **Strategy A: Redis Cache-Aside** | * Drastically reduces database CPU and Read I/O.<br>* Sub-millisecond read latency. | * Requires managing complex cache invalidation rules.<br>* Higher memory infrastructure cost. |
| **Strategy B: Real-Time Stream (SSE)** | * Near-zero database read queries over time.<br>* Immediate, premium real-time user UX. | * Holds open persistent connections, demanding high server socket capacity.<br>* Harder to scale horizontally without Redis Pub/Sub backplanes. |
| **Strategy C: Client Cache (Local/ETag)** | * Zero server resources hit for repeated sub-page navigations.<br>* Extremely easy to drop in. | * Risk of data staleness if notifications are modified from another device.<br>* Dependent on browser behavior and storage constraints. |

---

## 3. Recommended Approach
The optimal enterprise setup is a **hybrid of Strategy A and Strategy B**. Use an **SSE stream** to push incoming items down to active connections instantly, while letting any unexpected hard page-refreshes pull directly from a pre-warmed **Redis Cache cluster** rather than the primary core transactional database.


---

# Stage 5: Mass Broadcast Optimization & Fault Tolerance

This section reviews the shortcomings of synchronous mass looping, addresses partial failures, and provides an event-driven system redesign to guarantee reliable broadcast distribution across 50,000 students.

---

## 1. Shortcomings of the Current Implementation
The provided `notify_all` pseudocode features critical architectural flaws:
* **Synchronous & Blocking Bottleneck:** Executing `send_email`, `save_to_db`, and `push_to_app` sequentially inside a single loop for 50,000 students will cause the HTTP request to timeout. If each student's combined tasks take just 100ms, the entire function would block for **over 83 minutes**.
* **Tight Coupling / Single Point of Failure (SPOF):** If the external Email API slows down or fails, it stalls database updates and app streaming, bringing down the whole cycle.
* **Lack of Atomicity / No Retry State:** If the script crashes or encounters an error mid-loop, there is no state tracking to know where it left off, resulting in missing or duplicated deliveries.

---

## 2. Handling the 200 Midway Email Failures
Because the current script does not track state, we are stuck with a partial failure scenario:
* **The Problem:** 200 emails failed, but their database entries and app streams might have already executed (or vice-versa depending on where it crashed). Running the script again will cause the other 49,800 students to receive duplicate spam emails.
* **Immediate Fix:** Scan the database logs or query the external email gateway logs to find the 200 unnotified student IDs, slice them into an isolated array patch, and run a manual correction job specifically for them.

---

## 3. System Redesign: Reliable, Fast, & Decoupled
To scale this efficiently, the operations **should not happen together synchronously**. We must split the system into an **Asynchronous Event-Driven Architecture** using a message broker (e.g., RabbitMQ, Apache Kafka, or AWS SQS).

[ HR Click ]
│
▼
┌──────────────┐
│  Bulk Job    │ ---> Breaks 50k users into chunks
│  Dispatcher  │      & pushes discrete events to Queue
└──────┬───────┘
│
▼
┌──────────────┐
│Message Broker│ (RabbitMQ / Kafka)
└────┬───┬───┬─┘
│   │   │
│   │   └────────────────────────┐
▼   ▼                            ▼
┌───────────┐                    ┌───────────┐
│ Email     │ [Scale workers     │ DB/App    │ [Scale workers
│ Workers   │  independently]    │ Workers   │  independently]
└─────┬─────┘                    └─────┬─────┘
▼                                ▼
[Third-Party API]                [PostgreSQL / SSE]


### Should saving to DB and sending email happen together?
**No.** They operate at different speeds and dependencies. Saving to a database takes microseconds, while calling a third-party email service takes hundreds of milliseconds and is prone to network rate-limits. Decoupling them into separate messaging queues ensures a spike in email delays never prevents internal database logging or app notification streams.

---

## 4. Revised Architecture Pseudocode

Below is the rewritten, scalable solution using background job dispatching:

```python
# 1. Main API Endpoint Handler (Executes in milliseconds)
function notify_all_v2(target_audience_id: string, message: string):
    # Offload target lookup to a background manager to keep API responsive
    message_broker.publish("broadcast_job_queue", {
        "audience_id": target_audience_id,
        "message": message
    })
    return {"success": True, "status": "Broadcast job scheduled successfully."}

# 2. Bulk Job Consumer (Runs in background to chunk and queue individual tasks)
function process_broadcast_job(job_payload):
    student_ids = db.get_students_by_audience(job_payload.audience_id)
    
    # Process in chunks of 1000 to prevent memory allocation issues
    for chunk in chunk_array(student_ids, 1000):
        for student_id in chunk:
            # Publish individual, granular tasks to separate workers
            message_broker.publish("email_queue", {"student_id": student_id, "message": job_payload.message})
            message_broker.publish("in_app_queue", {"student_id": student_id, "message": job_payload.message})

# 3. Isolated Email Consumer Worker (With Dead Letter Queue & Retry handling)
@worker(queue="email_queue", retries=3, backoff="exponential")
function handle_email_delivery(task):
    try:
        send_email(task.student_id, task.message)
    except EmailAPIException as e:
        # If all 3 automatic retries fail, message broker moves this task
        # into a "dead_letter_queue" for isolated auditing without stopping the queue.
        raise e

# 4. Isolated Database & SSE Stream Consumer Worker
@worker(queue="in_app_queue")
function handle_in_app_delivery(task):
    # Perform lightweight DB insert
    save_to_db(task.student_id, task.message)
    # Stream over active SSE connection channel instantaneously
    push_to_app(task.student_id, task.message)



    ---

# Stage 6: Priority Inbox Algorithm Design

This section documents the custom business logic sorting implementation used to calculate the top 'n' high-importance notifications efficiently in memory.

---

## 1. Sorting Algorithm & Criteria Logic
To deliver a dynamic, high-value priority inbox window without crushing database compute constraints, the streaming raw notification feed is evaluated along two distinct vectors:

1. **Category Priority Weighting:** Hardcoded static weights are assigned where $\text{Placement (3)} > \text{Result (2)} > \text{Event (1)}$.
2. **Chronological Recency:** Inside matching weight categories, notifications are sorted using their epoch millisecond timestamp values to bring recent items to the top.

The compound sorting evaluation tuple can be modeled mathematically as:
$$\text{Score} = (\text{Priority\_Weight}, \text{Epoch\_Timestamp})$$

---

## 2. Maintaining Top 10 Scalability at Scale
When streams scale to millions of continuous data pulses, running global array re-sorting cascades can quickly turn into a $O(N \log N)$ bottleneck. To process updates with optimal resource usage, we recommend implementing a **Bounded Min-Heap Structure** (Priority Queue):

* **The Strategy:** Initialize an in-memory Min-Heap capped at a maximum length of 10 elements.
* **Stream Insertion Logic:** For every incoming message notification, evaluate its score against the current root item of the heap (the lowest scoring element currently inside your top 10).
    * If the new element's score is lower than the root, it is discarded immediately ($O(1)$ verification cost).
    * If it is higher, drop the heap root and insert the new element ($O(\log K)$ where $K=10$).
* This maintains the optimal Top 10 list at a fixed processing run configuration cost, scaling linearly at an overall complexity of $O(N \log K)$ instead of bloating.

---

# Stage 7: Frontend Architecture & UI Design Constraints

This section covers the frontend design choices, integration strategies for state tracking, and query parameter handling for the React implementation.

---

## 1. Logging Middleware & Call Stack Shifts
To capture UI errors, performance measurements, and api network failures seamlessly, a dedicated logging middleware interceptor is wrapped around the application's global fetch or Axios client. 
* **Placement:** Positioned immediately after initial state dispatch actions but before hitting the network adapter interface.
* **Functionality:** This ensures any `401 Unauthorized` or network drops don't break the rendering loop, allowing the application stack to catch exceptions and switch gracefully to an elegant fallback state without degrading the user experience.

---

## 2. State Strategy: Tracking New vs. Viewed Notifications
To distinguish cleanly between "New" and "Already Viewed" notifications without cross-contaminating components:
* **Unique ID Map Store:** Incoming notifications are mapped inside a tracking lookup dictionary using their unique `ID` hash string as keys.
* **Persistent Cache Layer:** A user’s viewed array is mirrored locally using the browser's `localStorage` API. During the app initialization lifecycle, the store reconciles the remote API arrays against the cached keys, instantly flagging items as unread or read without forcing redundant back-and-forth updates to the primary server database.

---

## 3. Query Parameters & Material UI Layout Design
The interface explicitly utilizes the expanded query parameter filters (`page`, `limit`, `notification_type`) requested by the evaluation criteria:
* **Filtering and Control:** Leverages custom Material UI selects and text menus to swap values into state hooks seamlessly.
* **Aesthetic Constraints:** Strictly built using standard Material UI themes, typography tokens, and tables to avoid UI clutter, ensuring layout stability across mobile viewports and desktop monitors.