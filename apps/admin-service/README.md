# admin-service

Administration microservice for the UCE Alumni & Employment Platform — the 10th
microservice. Provides admin-only user management (list, edit role/status,
deactivate) over the platform's shared `users` table.

---

## ⚠️ Schema assumption — verify before deploying

This service does **not** create its own `admin_users` table. It manages the
existing `users` table in `jobs_db` (already read by `analytics-service`,
`jobs-service`, `matching-service`). On startup it idempotently ensures two
columns exist:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
```

**Before merging to QA**, confirm against the real `users` table (owned by
`auth-service`) that:
- A `users` table actually exists in `jobs_db` with an `id` primary key.
- Column names `username`, `email`, `created_at` match what's really there
  (adjust `SAFE_COLUMNS` in `src/routes/users.ts` if they differ).

If the real schema is different, this is a 5-minute fix in `src/db.ts` and
`src/routes/users.ts` — the rest of the service (auth, routing, tests) is
schema-agnostic.

---

## Endpoints

All endpoints (except `/health`) require header `Authorization: Bearer <token>`
with a JWT whose payload includes `role: "admin"`. No token → `401`. Valid
token without admin role → `403`.

### `GET /health`
Public health check.

```json
{ "status": "ok", "service": "admin-service", "timestamp": "2026-07-05T00:00:00.000Z" }
```

### `GET /users?limit=50&offset=0`
List users (paginated, `limit` capped at 200).

```json
{
  "data": [
    { "id": 1, "username": "ana", "email": "ana@uce.edu.ec", "role": "user", "is_active": true, "created_at": "2026-01-01T00:00:00.000Z" }
  ],
  "count": 1
}
```

### `PUT /users/:id`
Partial update — body may include either or both fields.

```json
{ "role": "admin", "is_active": true }
```

Returns `404` if the user doesn't exist, `400` if the body has neither field.

### `DELETE /users/:id`
**Soft delete** — sets `is_active = false` rather than removing the row, to
avoid breaking foreign keys from `jobs`/`matches`/`profiles` that likely
reference `user_id`. Returns the updated (deactivated) user, or `404` if not
found.

> Change to a real `DELETE FROM users WHERE id = $1` in
> `src/routes/users.ts` if the team decides hard deletion is actually
> required — flagged here so it isn't a silent design decision.

---

## Environment Variables

| Variable      | Default    | Description                          |
|---------------|------------|----------------------------------------|
| `PORT`        | `3009`     | Service port                           |
| `NODE_ENV`    | —          | `production` in QA/PROD                |
| `JWT_SECRET`  | —          | Shared secret to verify JWTs (required)|
| `PG_HOST`     | `postgres` | PostgreSQL host                        |
| `PG_PORT`     | `5432`     | PostgreSQL port                        |
| `PG_DATABASE` | `jobs_db`  | Database name (shared with other services) |
| `PG_USER`     | `postgres` | PostgreSQL user                        |
| `PG_PASSWORD` | —          | PostgreSQL password (required)         |

These already match what's injected via Ansible in both `deploy-qa.yml` and
`deploy-prod.yml` — no changes needed there.

---

## Structure

```
admin-service/
├── src/
│   ├── index.ts              # Entry point: Express app, /health, mounts /users
│   ├── db.ts                 # PG pool + idempotent column check on `users`
│   ├── middleware/
│   │   └── auth.ts           # requireAdmin: validates JWT + role:admin
│   ├── routes/
│   │   └── users.ts          # GET/PUT/DELETE /users
│   └── users.test.ts         # 11 tests (Jest + Supertest, pool mocked)
├── Dockerfile                 # Multistage build, non-root user, port 3009
├── package.json
└── tsconfig.json
```

## Run locally

```bash
npm install
export JWT_SECRET=dev-secret
export PG_PASSWORD=UCEjobs2024!
npm run dev              # ts-node-dev with hot reload
```

## Build and tests

```bash
npm run build   # compiles to dist/ with tsc
npm test        # jest --forceExit --detectOpenHandles
npm start        # runs dist/index.js (requires prior build)
```

| Test                                             | Description |
|---------------------------------------------------|--------------|
| GET /users → 401 without Authorization header      | ✅ |
| GET /users → 401 with invalid token                | ✅ |
| GET /users → 403 if not admin                      | ✅ |
| GET /users → 200 with list for admin               | ✅ |
| GET /users → caps limit at 200                     | ✅ |
| GET /users → 500 on DB error                       | ✅ |
| PUT /users/:id → 400 with empty body               | ✅ |
| PUT /users/:id → 404 if user not found              | ✅ |
| PUT /users/:id → 200 updates role                  | ✅ |
| DELETE /users/:id → 404 if user not found           | ✅ |
| DELETE /users/:id → 200 soft-deletes (is_active=false) | ✅ |

## Docker

```bash
docker build -t josephp2001/uce-admin-service:qa .

docker run -d \
  --name admin-service \
  --network uce-network \
  --restart always \
  -e NODE_ENV=production \
  -e PORT=3009 \
  -e JWT_SECRET="$JWT_SECRET" \
  -e PG_HOST=postgres \
  -e PG_PORT=5432 \
  -e PG_DATABASE=jobs_db \
  -e PG_USER=postgres \
  -e PG_PASSWORD="$PG_PASSWORD" \
  josephp2001/uce-admin-service:qa
```

**Docker Hub images:**
- QA: `josephp2001/uce-admin-service:qa`
- PROD: `josephp2001/uce-admin-service:latest`

Both already wired into `deploy-qa.yml`, `deploy-prod.yml`, both Ansible
playbooks, and `nginx.conf` (`/api/admin/*`) — no infra changes needed, only
this code.

## Nginx (already configured)

```nginx
location /api/admin/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://admin_service/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Because `proxy_pass` ends in `/` with no path suffix, a client request to
`/api/admin/users` arrives at this service as `/users` — which is exactly
where `usersRouter` is mounted in `src/index.ts`.

## Architecture

```
Admin (web-app /admin page)
  └── GET/PUT/DELETE /api/admin/users(/:id)
        └── nginx strips /api/admin/ → forwards /users(/:id)
              └── requireAdmin middleware (JWT verify + role check)
                    └── SELECT/UPDATE on shared `users` table (jobs_db)
```

## CI/CD

```
push to QA   → npm test → docker build → docker push :qa     → ansible deploy QA
merge master → npm test → docker build → docker push :latest → ansible deploy PROD
```

Both `build-admin` jobs and the `deploy` job's `needs:` list are already in
place in `deploy-qa.yml` / `deploy-prod.yml` — this service just needs to
exist in the repo for those jobs to succeed.
