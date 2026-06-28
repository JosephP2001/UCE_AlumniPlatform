# audit-service

Audit microservice for the UCE Alumni & Employment Platform.

Consumes Kafka events (`job.created`) and persists them to PostgreSQL. Exposes a read endpoint for admins to query the audit log.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `GET` | `/audit?limit=50&event_type=X` | Bearer (role:admin) | Query audit logs |

### Example Responses

**GET /health**
```json
{ "status": "ok", "service": "audit-service", "timestamp": "2026-06-02T00:00:00.000Z" }
```

**GET /audit?limit=2&event_type=job.created**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "event_type": "job.created",
      "payload": { "title": "Backend Dev", "user_id": "42" },
      "user_id": "42",
      "timestamp": "2026-06-10T14:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## Kafka Consumer

- **Topic:** `job.created`
- **Group ID:** `audit-service-group`
- **Behavior:** Each consumed message is inserted into `audit_logs` as a row with `event_type = 'job.created'`

---

## Database

**Table:** `audit_logs` in `jobs_db` (PostgreSQL)

```sql
CREATE TABLE audit_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  payload    JSONB       NOT NULL DEFAULT '{}',
  user_id    VARCHAR(100),
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Created automatically on service startup via `initDB()`.

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Service port | `3006` |
| `NODE_ENV` | Environment | `production` |
| `JWT_SECRET` | Secret for verifying JWT tokens | injected via Ansible |
| `PG_HOST` | PostgreSQL host | `postgres` |
| `PG_PORT` | PostgreSQL port | `5432` |
| `PG_DATABASE` | Database name | `jobs_db` |
| `PG_USER` | PostgreSQL user | `postgres` |
| `PG_PASSWORD` | PostgreSQL password | injected via Ansible |
| `KAFKA_BROKERS` | Kafka broker list (comma-separated) | `kafka:9092` |

---

## Unit Tests

```bash
cd apps/audit-service
npm install
npm test
```

| Test | Description |
|------|-------------|
| should return 401 if no Authorization header | ✅ |
| should return 401 if token is invalid | ✅ |
| should return 403 if user is not admin | ✅ |
| should return 200 with audit logs for admin | ✅ |
| should filter by event_type when provided | ✅ |
| should cap limit at 200 | ✅ |
| should return 500 on DB error | ✅ |

---

## Docker

**Build:**
```bash
docker build -t josephp2001/uce-audit-service:qa ./apps/audit-service
```

**Run locally:**
```bash
docker run -d \
  --name audit-service \
  --network uce-network \
  -p 3006:3006 \
  -e PORT=3006 \
  -e JWT_SECRET=your-secret \
  -e PG_HOST=postgres \
  -e PG_PASSWORD=UCEjobs2024! \
  -e KAFKA_BROKERS=kafka:9092 \
  josephp2001/uce-audit-service:qa
```

**Docker Hub images:**
- QA: `josephp2001/uce-audit-service:qa`
- PROD: `josephp2001/uce-audit-service:latest`

---

## Architecture

```
Kafka (topic: job.created)
  └── kafkaConsumer.ts
        └── INSERT INTO audit_logs

Client (admin)
  └── GET /audit?limit=50&event_type=job.created
        └── requireAdmin middleware (JWT verify + role check)
              └── SELECT FROM audit_logs
```

---

## Nginx

Add to nginx config:
```nginx
location /api/audit/ {
  proxy_pass http://audit-service:3006/audit/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

---

## CI/CD

```
push to QA   → npm test (7/7) → docker build → docker push :qa     → ansible deploy QA
merge master → npm test (7/7) → docker build → docker push :latest → ansible deploy PROD
```
