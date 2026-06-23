# auth-service

Authentication microservice for the UCE Alumni & Employment Platform.

Handles GitHub OAuth 2.0 login, JWT token issuance, session management, and token refresh via Redis.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `GET` | `/auth/github` | No | Redirects to GitHub OAuth authorization page |
| `GET` | `/auth/github/callback` | No | GitHub OAuth callback — issues JWT and redirects to frontend |
| `POST` | `/auth/refresh` | Cookie | Refreshes access token using refresh token cookie |
| `POST` | `/auth/logout` | Cookie | Clears refresh token cookie |
| `GET` | `/auth/me` | Bearer | Returns authenticated user data |

### Example Responses

**GET /health**
```json
{ "status": "ok", "service": "auth-service", "timestamp": "2026-06-02T00:00:00.000Z" }
```

**GET /auth/github/callback** (success)

Redirects to:
```
http://<FRONTEND_URL>/auth/callback?token=<JWT>&user=<encoded_user_json>
```

**GET /auth/me**
```json
{
  "user": {
    "id": 123,
    "username": "josephp2001",
    "name": "Joseph Ponce",
    "avatar": "https://avatars.githubusercontent.com/u/...",
    "provider": "github"
  }
}
```

---

## OAuth Flow

```
1. Client → GET /auth/github
2. auth-service → redirect → GitHub OAuth (github.com/login/oauth/authorize)
3. User authorizes → GitHub → GET /auth/github/callback?code=xxx
4. auth-service exchanges code for GitHub token
5. auth-service fetches user info from GitHub API
6. auth-service issues JWT (15min) + refresh token (7d httpOnly cookie)
7. auth-service → redirect → FRONTEND_URL/auth/callback?token=JWT&user=...
8. Frontend stores token in sessionStorage and displays user
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Service port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `JWT_SECRET` | Secret for signing JWT tokens | injected via Ansible |
| `OAUTH_CLIENT_ID` | GitHub OAuth App Client ID | injected via Ansible |
| `OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret | injected via Ansible |
| `REDIS_HOST` | Redis container hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `FRONTEND_URL` | Frontend base URL for OAuth redirect | `http://<BASTION_IP>` |

> **Note:** QA and PROD use separate GitHub OAuth Apps with separate credentials injected at deploy time via Ansible.

---

## Token Strategy

| Token | Expiry | Storage |
|-------|--------|---------|
| Access Token (JWT) | 15 minutes | URL param → sessionStorage (frontend) |
| Refresh Token | 7 days | httpOnly cookie (server-side) |

Refresh tokens are stored in Redis with TTL. On logout, the cookie is cleared.

---

## Unit Tests

```bash
cd apps/auth-service
npm install
npm test
```

**Results:** 8/8 passing

| Test | Status |
|------|--------|
| should redirect to GitHub OAuth URL | ✅ |
| should return 400 if no code provided | ✅ |
| should redirect with access token on valid code | ✅ |
| should return 401 if no refresh token | ✅ |
| should return new access token on valid refresh token | ✅ |
| should clear cookie and return success message | ✅ |
| should return 401 if no token | ✅ |
| should return user data on valid token | ✅ |

---

## Docker

**Build:**
```bash
docker build -t josephp2001/uce-auth-service:qa ./apps/auth-service
```

**Run locally:**
```bash
docker run -d \
  --name auth-service \
  --network uce-network \
  -p 3000:3000 \
  -e PORT=3000 \
  -e JWT_SECRET=your-secret \
  -e OAUTH_CLIENT_ID=your-client-id \
  -e OAUTH_CLIENT_SECRET=your-client-secret \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  -e FRONTEND_URL=http://localhost \
  josephp2001/uce-auth-service:qa
```

**Docker Hub images:**
- QA: `josephp2001/uce-auth-service:qa`
- PROD: `josephp2001/uce-auth-service:latest`

---

## Architecture

```
Client
  └── GET /auth/github
        └── GitHub OAuth (github.com)
              └── GET /auth/github/callback?code=xxx
                    ├── Exchange code → GitHub access token
                    ├── Fetch user info from GitHub API
                    ├── Issue JWT access token (15min)
                    ├── Issue refresh token → Redis (7d TTL, httpOnly cookie)
                    └── Redirect → FRONTEND_URL/auth/callback?token=JWT&user=...
```

**Design principle:** Single Responsibility — this service handles authentication only.

---

## Logging

Uses Winston for structured JSON logging:

```json
{"level":"info","message":"auth-service started","port":"3000","env":"production","service":"auth-service","timestamp":"2026-06-05T00:00:00.000Z"}
{"level":"info","message":"Health check called","service":"auth-service","timestamp":"2026-06-05T00:00:00.000Z"}
```

---

## CI/CD

```
push to QA → npm test (8/8) → docker build → docker push :qa → ansible deploy QA
merge to master → npm test (8/8) → docker build → docker push :latest → ansible deploy PROD
```
