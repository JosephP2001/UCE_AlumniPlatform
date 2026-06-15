# notification-service

Notification microservice for the UCE Alumni & Employment Platform.

Consumes events from RabbitMQ (`job_created`, `new_match`) and persists notifications to PostgreSQL. Exposes REST endpoints for reading and marking notifications. Implements the **Open/Closed Principle** via `INotificationChannel` — new delivery channels (SMS, Push, Slack) can be added without modifying existing code.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `GET` | `/notifications/:userId` | Bearer | List notifications for a user (last 50) |
| `PUT` | `/notifications/:id/read` | Bearer | Mark a notification as read |

### Example Responses

**GET /health**
```json
{ "status": "ok", "service": "notification-service", "timestamp": "2026-06-14T00:00:00.000Z" }
```

**GET /notifications/:userId**
```json
{
  "notifications": [
    {
      "id": 1,
      "user_id": "176180233",
      "type": "job_created",
      "title": "Job listing published",
      "message": "Your job listing \"Frontend Developer\" at TechCorp is now live.",
      "metadata": { "jobId": 42 },
      "read": false,
      "created_at": "2026-06-14T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## RabbitMQ Events Consumed

| Queue | Published by | Payload |
|-------|-------------|---------|
| `job_created` | jobs-service | `{ jobId, title, company, userId }` |
| `new_match` | matching-service (Phase 4) | `{ studentId, jobId, jobTitle, score }` |

Both queues are declared as `durable: true` — messages survive RabbitMQ restarts.

---

## Architecture — Open/Closed Principle

```
RabbitMQ
  ├── job_created  ──► NotificationConsumer
  └── new_match    ──►       │
                             ▼
                    NotificationService.notify()
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
              EmailChannel      PushChannel
              (mock)            (mock)
                    │
                    ▼
              PostgreSQL — notifications table
```

To add a new channel (e.g. Slack), create a class implementing `INotificationChannel` and register it in `index.ts` — no existing code changes required.

```typescript
// INotificationChannel interface
export interface INotificationChannel {
  readonly channelName: string;
  send(payload: NotificationPayload): Promise<void>;
}
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Service port | `3004` |
| `NODE_ENV` | Environment | `production` |
| `POSTGRES_HOST` | PostgreSQL hostname | `postgres` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Database name | `jobs_db` |
| `POSTGRES_USER` | PostgreSQL user | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | injected via Ansible |
| `JWT_SECRET` | Shared secret with auth-service | injected via Ansible |
| `RABBITMQ_URL` | RabbitMQ connection URL | `amqp://admin:password@rabbitmq:5672` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `http://localhost:3002` |

---

## Database Schema

Auto-migrated on startup via `CREATE TABLE IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     VARCHAR(50)  NOT NULL,
  type        VARCHAR(100) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     TEXT,
  metadata    JSONB        DEFAULT '{}',
  read        BOOLEAN      DEFAULT FALSE,
  created_at  TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
```

---

## Swagger UI

Available at `/api-docs` when the service is running:

```
http://localhost:3004/api-docs           # local
http://98.86.126.222/api/notification-docs    # QA (via Nginx)
```

---

## Unit Tests

```bash
cd apps/notification-service
npm install
npm test
```

---

## Docker

**Build:**
```bash
docker build -t josephp2001/uce-notification-service:qa ./apps/notification-service
```

**Run locally:**
```bash
docker run -d \
  --name notification-service \
  --network uce-network \
  -p 3004:3004 \
  -e PORT=3004 \
  -e POSTGRES_HOST=postgres \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_DB=jobs_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your-password \
  -e JWT_SECRET=your-secret \
  -e RABBITMQ_URL=amqp://admin:password@rabbitmq:5672 \
  josephp2001/uce-notification-service:qa
```

**Docker Hub images:**
- QA: `josephp2001/uce-notification-service:qa`
- PROD: `josephp2001/uce-notification-service:latest`

---

## CI/CD

```
push to QA → npm test → docker build → docker push :qa → ansible deploy QA
merge to master → npm test → docker build → docker push :latest → ansible deploy PROD
```