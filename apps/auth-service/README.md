# auth-service

Authentication microservice for the UCE Alumni & Employment Platform.

Handles GitHub OAuth 2.0 login, JWT token issuance, session management, and token refresh via Redis.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `GET` | `/auth/github` | No | Redirects to GitHub OAuth |
| `GET` | `/auth/github/callback` | No | GitHub OAuth callback — issues JWT |
| `POST` | `/auth/refresh` | Cookie | Refreshes access token using refresh token |
| `POST` | `/auth/logout` | Cookie | Clears refresh token cookie |
| `GET` | `/auth/me` | Bearer | Returns authenticated user data |

### Example Responses

**GET /health**
```json
{ "status": "ok", "service": "auth-service", "timestamp": "2026-06-02T00:00:00.000Z" }
```

**GET /auth/me**
```json
{ "user": { "id": 1, "login": "josephp2001", "role": "alumni" } }
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Service port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `JWT_SECRET` | Secret for signing JWT tokens | `your-secret` |
| `OAUTH_CLIENT_ID` | GitHub OAuth App Client ID | `Iv1.abc123` |
| `OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret | `abc123...` |
| `REDIS_HOST` | Redis container hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |

---

## Token Strategy

| Token | Expiry | Storage |
|-------|--------|---------|
| Access Token (JWT) | 15 minutes | Bearer header |
| Refresh Token | 7 days | httpOnly cookie |

Refresh tokens are stored in Redis with TTL. On logout, the key is deleted immediately.

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
| should return access token on valid code | ✅ |
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
        └── GitHub OAuth
              └── /auth/github/callback
                    ├── JWTService → access token (15min)
                    └── Redis → refresh token (7d, httpOnly cookie)
```

**Design principle:** Single Responsibility — this service handles authentication only, no business logic from other domains.

---

## CI/CD

Automated via GitHub Actions on push to `QA` branch:

```
push to QA → npm test (8/8) → docker build → docker push → ansible deploy
```
