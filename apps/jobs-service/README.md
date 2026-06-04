# jobs-service

Job listings microservice for the UCE Alumni & Employment Platform.

Implements the CQRS (Command Query Responsibility Segregation) pattern:
- **Write** operations persist to PostgreSQL
- **Read** operations are served from Redis cache-first with automatic PostgreSQL fallback

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/jobs` | No | Create a new job listing |
| `GET` | `/jobs` | No | Get all jobs (cache-first) |
| `GET` | `/jobs/:id` | No | Get job by ID (cache-first) |

### Example Requests & Responses

**POST /jobs**
```bash
curl -X POST http://localhost:3001/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Software Engineer",
    "company": "UCE",
    "description": "Backend developer",
    "location": "Quito",
    "salary": "$3000"
  }'
```
```json
{
  "job": {
    "id": 1,
    "title": "Software Engineer",
    "company": "UCE",
    "description": "Backend developer",
    "location": "Quito",
    "salary": "$3000",
    "created_at": "2026-06-02T00:00:00.000Z"
  }
}
```

**GET /jobs** (first call — cache miss)
```json
{ "jobs": [...], "source": "database" }
```

**GET /jobs** (subsequent call — cache hit)
```json
{ "jobs": [...], "source": "cache" }
```

**GET /health**
```json
{ "status": "ok", "service": "jobs-service", "timestamp": "2026-06-02T00:00:00.000Z" }
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Service port | `3001` |
| `NODE_ENV` | Environment | `production` |
| `PG_HOST` | PostgreSQL container hostname | `postgres` |
| `PG_PORT` | PostgreSQL port | `5432` |
| `PG_DATABASE` | Database name | `jobs_db` |
| `PG_USER` | PostgreSQL user | `postgres` |
| `PG_PASSWORD` | PostgreSQL password | injected via Ansible |
| `REDIS_HOST` | Redis container hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |

---

## Database Schema

Auto-migrated on service startup via `CREATE TABLE IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  company     VARCHAR(255) NOT NULL,
  description TEXT,
  location    VARCHAR(255),
  salary      VARCHAR(100),
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## CQRS Pattern

```
POST /jobs  ──► CreateJobCommandHandler ──► PostgreSQL (write)
                                        └── Redis INVALIDATE jobs:all

GET /jobs   ──► GetJobsQueryHandler ──► Redis GET jobs:all
                                    └── (cache miss) PostgreSQL SELECT *
                                                   └── Redis SETEX jobs:all 60

GET /jobs/:id ► GetJobByIdQueryHandler ──► Redis GET jobs:{id}
                                       └── (cache miss) PostgreSQL SELECT WHERE id=$1
                                                      └── Redis SETEX jobs:{id} 60
```

**Cache TTL:** 60 seconds. Invalidated on every write.

---

## Unit Tests

```bash
cd apps/jobs-service
npm install
npm test
```

**Results:** 6/6 passing

| Test | Status |
|------|--------|
| should return 400 if title or company is missing | ✅ |
| should create a job and return 201 | ✅ |
| should return cached jobs if cache hit | ✅ |
| should query PostgreSQL on cache miss | ✅ |
| should return 404 if job not found | ✅ |
| should return job from database on cache miss | ✅ |

---

## Docker

**Build:**
```bash
docker build -t josephp2001/uce-jobs-service:qa ./apps/jobs-service
```

**Run locally** (requires postgres and redis containers on uce-network):
```bash
docker run -d \
  --name jobs-service \
  --network uce-network \
  -p 3001:3001 \
  -e PORT=3001 \
  -e PG_HOST=postgres \
  -e PG_PORT=5432 \
  -e PG_DATABASE=jobs_db \
  -e PG_USER=postgres \
  -e PG_PASSWORD=your-password \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  josephp2001/uce-jobs-service:qa
```

**Docker Hub images:**
- QA: `josephp2001/uce-jobs-service:qa`
- PROD: `josephp2001/uce-jobs-service:latest`

---

## Architecture

```
jobs-service
├── COMMAND SIDE (Write)
│   └── POST /jobs → PostgreSQL jobs_db → invalidate Redis cache
└── QUERY SIDE (Read)
    ├── GET /jobs → Redis cache (60s TTL) → fallback PostgreSQL
    └── GET /jobs/:id → Redis cache (60s TTL) → fallback PostgreSQL
```

**Design principle:** CQRS + Interface Segregation — read and write interfaces are fully separated, allowing independent scaling of each path.

---

## CI/CD

Automated via GitHub Actions on push to `QA` branch:

```
push to QA → npm test (6/6) → docker build → docker push → ansible deploy
```
