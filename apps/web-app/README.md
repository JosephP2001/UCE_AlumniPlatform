# web-app

Frontend for the UCE Alumni & Employment Platform.

Built with Next.js 16 + React 19 + Tailwind CSS 4. Single-page application that consumes auth-service and jobs-service via Nginx reverse proxy.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — service status dashboard + job listings |
| `/auth/callback` | OAuth callback handler — captures JWT from URL and stores in sessionStorage |

---

## Components

| Component | Description |
|-----------|-------------|
| `ServiceStatus` | Polls `/api/auth/health` and `/api/jobs/health` — displays green/red dot per service |
| `JobsList` | Fetches `/api/jobs` — lists job cards with cache/database source badge |

---

## Authentication Flow

```
1. User clicks "Login with GitHub"
2. Browser → GET /api/auth/github → auth-service redirects to GitHub
3. User authorizes → GitHub → GET /api/auth/github/callback
4. auth-service issues JWT → redirects to /auth/callback?token=JWT&user=...
5. /auth/callback stores token + user in sessionStorage → redirects to /
6. Header shows user avatar, name, and Logout button
```

Token storage: `sessionStorage` (cleared on tab close). Refresh token handled server-side via httpOnly cookie.

---

## API Routes (via Nginx)

All API calls use relative URLs — Nginx routes them internally:

| Frontend Call | Nginx routes to |
|--------------|-----------------|
| `GET /api/auth/health` | auth-service:3000/health |
| `GET /api/auth/github` | auth-service:3000/auth/github |
| `GET /api/jobs/health` | jobs-service:3001/health |
| `GET /api/jobs` | jobs-service:3001/jobs |
| `POST /api/jobs` | jobs-service:3001/jobs |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_AUTH_URL` | Auth service base URL (build-time) | `''` (relative) |
| `NEXT_PUBLIC_JOBS_URL` | Jobs service base URL (build-time) | `''` (relative) |

> All URLs are relative in production — Nginx handles routing. Variables are only needed for local development pointing directly to service ports.

---

## Local Development

```bash
cd apps/web-app
npm install
npm run dev
```

Open `http://localhost:3000`.

For local development with services running:
```bash
# .env.local
NEXT_PUBLIC_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_JOBS_URL=http://localhost:3001
```

---

## Build

```bash
npm run build
```

Uses `output: "standalone"` for Docker deployment.

---

## Docker

**Build:**
```bash
docker build \
  --build-arg NEXT_PUBLIC_AUTH_URL='' \
  --build-arg NEXT_PUBLIC_JOBS_URL='' \
  -t josephp2001/uce-web-app:qa \
  ./apps/web-app
```

**Run** (behind Nginx on uce-network):
```bash
docker run -d \
  --name web-app \
  --network uce-network \
  -e NODE_ENV=production \
  josephp2001/uce-web-app:qa
```

**Docker Hub images:**
- QA: `josephp2001/uce-web-app:qa`
- PROD: `josephp2001/uce-web-app:latest`

---

## Architecture

```
Browser
  └── http://<IP>:80 (Nginx)
        ├── /api/auth/* → auth-service:3000
        ├── /api/jobs   → jobs-service:3001
        └── /*          → web-app:3002 (Next.js)
```

**Design principle:** Single frontend consuming multiple microservices via Nginx reverse proxy. No hardcoded IPs — all routing is relative.

---

## CI/CD

```
push to QA → docker build → docker push :qa → ansible deploy QA (port 3002, behind Nginx)
merge to master → docker build → docker push :latest → ansible deploy PROD
```
