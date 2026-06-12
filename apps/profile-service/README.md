# profile-service

Alumni profile microservice for the UCE Alumni & Employment Platform.

Manages user profile data for UCE alumni. Integrates with `auth-service` via shared JWT secret — the same token issued after GitHub OAuth login is used to authenticate profile write operations.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `GET` | `/profile` | No | List all profiles |
| `GET` | `/profile/:userId` | No | Get profile by GitHub user ID |
| `POST` | `/profile` | Bearer | Create profile for authenticated user |
| `PUT` | `/profile/:userId` | Bearer | Update own profile (owner only) |

> **Note:** `userId` is the GitHub numeric user ID embedded in the JWT payload (e.g. `204424189`).

### Example Requests & Responses

**POST /profile**
```bash
curl -X POST http://localhost/api/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{
    "full_name": "Joseph Ponce",
    "career": "Sistemas de Información",
    "graduation_year": 2025,
    "bio": "Backend developer, UCE alumni",
    "skills": "Node.js, TypeScript, AWS, Docker",
    "location": "Quito, Ecuador",
    "linkedin_url": "https://linkedin.com/in/josephponce"
  }'
```
```json
{
  "profile": {
    "id": 1,
    "user_id": "204424189",
    "username": "JosephP2001",
    "full_name": "Joseph Ponce",
    "career": "Sistemas de Información",
    "graduation_year": 2025,
    "bio": "Backend developer, UCE alumni",
    "skills": "Node.js, TypeScript, AWS, Docker",
    "location": "Quito, Ecuador",
    "linkedin_url": "https://linkedin.com/in/josephponce",
    "created_at": "2026-06-12T00:49:37.445Z",
    "updated_at": "2026-06-12T00:49:37.445Z"
  }
}
```

**GET /health**
```json
{ "status": "ok", "service": "profile-service", "timestamp": "2026-06-12T00:00:00.000Z" }
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Service port | `3003` |
| `NODE_ENV` | Environment | `production` |
| `POSTGRES_HOST` | PostgreSQL container hostname | `postgres` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Database name | `jobs_db` |
| `POSTGRES_USER` | PostgreSQL user | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | injected via Ansible |
| `JWT_SECRET` | Shared secret with auth-service | injected via Ansible |

---

## Database Schema

Auto-migrated on service startup via `CREATE TABLE IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(50) UNIQUE NOT NULL,
  username        VARCHAR(100),
  full_name       VARCHAR(255),
  career          VARCHAR(255),
  graduation_year INTEGER,
  bio             TEXT,
  skills          TEXT,
  location        VARCHAR(255),
  linkedin_url    VARCHAR(500),
  avatar_url      VARCHAR(500),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

## JWT Integration

The profile-service shares `JWT_SECRET` with auth-service. When a user logs in via GitHub OAuth, auth-service issues a JWT containing:

```json
{
  "id": 204424189,
  "username": "JosephP2001",
  "name": "Joseph Ponce",
  "avatar": "https://avatars.githubusercontent.com/...",
  "provider": "github"
}
```

The profile-service middleware extracts `id` and `username` from this token to identify the user — no separate authentication is needed.

---

## Swagger UI

Available at `/api-docs` when the service is running:

```
http://localhost:3003/api-docs        # local
http://52.20.54.196/api/profile-docs  # QA (via Nginx)
```

---

## Unit Tests

```bash
cd apps/profile-service
npm install
npm test
```

---

## Docker

**Build:**
```bash
docker build -t josephp2001/uce-profile-service:qa ./apps/profile-service
```

**Run locally** (requires postgres on uce-network):
```bash
docker run -d \
  --name profile-service \
  --network uce-network \
  -p 3003:3003 \
  -e PORT=3003 \
  -e POSTGRES_HOST=postgres \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_DB=jobs_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your-password \
  -e JWT_SECRET=your-secret \
  josephp2001/uce-profile-service:qa
```

**Docker Hub images:**
- QA: `josephp2001/uce-profile-service:qa`
- PROD: `josephp2001/uce-profile-service:latest`

---

## Architecture

```
profile-service
├── POST /profile  → validate JWT → INSERT profiles → return profile
├── PUT  /profile/:userId → validate JWT → verify owner → UPDATE profiles
├── GET  /profile  → SELECT all profiles
└── GET  /profile/:userId → SELECT WHERE user_id = $1
```

**Design principle:** Single Responsibility — this service handles alumni profile data only. Authentication is delegated to the shared JWT secret from auth-service.

---

## CI/CD

```
push to QA → npm test → docker build → docker push :qa → ansible deploy QA
merge to master → npm test → docker build → docker push :latest → ansible deploy PROD
```