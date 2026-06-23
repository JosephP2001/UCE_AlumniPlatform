# web-app

Frontend for the UCE Alumni & Employment Platform.

Built with **Next.js 16 + React 19 + Tailwind CSS 4**. Consumes all backend services via Nginx reverse proxy — no hardcoded IPs.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — service status, job listings, user session |
| `/auth/login` | Login page — GitHub OAuth entry point |
| `/auth/callback` | OAuth callback — captures JWT from URL, stores in sessionStorage |
| `/jobs/new` | Post a job — accessible only to users with `role: company` |

---

## Components

| Component | Description |
|-----------|-------------|
| `ServiceStatus` | Polls `/api/auth/health` and `/api/jobs/health` — displays green/red dot per service |
| `JobsList` | Fetches `/api/jobs` — lists job cards with job type badge, requirements, and cache/database source indicator |

---

## Authentication Flow

```
1. User visits / → no session → redirected to /auth/login
2. User clicks "Continue with GitHub"
3. Browser → GET /api/auth/github → auth-service redirects to GitHub
4. User authorizes → GitHub → GET /api/auth/github/callback
5. auth-service issues JWT → redirects to /auth/callback?token=JWT&user=...
6. /auth/callback stores token + user in sessionStorage → redirects to /
7. Dashboard shows role picker modal (student / company) on first login
```

Token storage: `sessionStorage` (cleared on tab close). Refresh token handled server-side via httpOnly cookie.

---

## Role System

Roles are assigned client-side after OAuth login and stored in `sessionStorage`.

| Role | Access |
|------|--------|
| `student` | Browse job listings |
| `company` | Browse listings + post new jobs (`/jobs/new`) |

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
| `GET /api/profile/*` | profile-service:3003/profile/* |
| `GET /api/matching/health` | matching-service:3005/health |

---

## Environment Variables

| Variable | Description | QA | PROD |
|----------|-------------|-----|------|
| `NEXT_PUBLIC_AUTH_URL` | Auth service base URL (build-time) | `http://<QA_BASTION_IP>` | `http://josheponcepro1.distribuidauce.org` |
| `NEXT_PUBLIC_JOBS_URL` | Jobs service base URL (build-time) | `http://<QA_BASTION_IP>` | `http://josheponcepro1.distribuidauce.org` |
| `NEXT_PUBLIC_PROFILE_URL` | Profile service base URL (build-time) | `http://<QA_BASTION_IP>` | `http://josheponcepro1.distribuidauce.org` |
| `NEXT_PUBLIC_NOTIFICATIONS_URL` | Notification service base URL (build-time) | `http://<QA_BASTION_IP>` | `http://josheponcepro1.distribuidauce.org` |

> In production all paths are relative — Nginx handles routing. These variables are injected at Docker build time by the CI/CD workflow.

---

## Local Development

```bash
cd apps/web-app
npm install
npm run dev
```

Open `http://localhost:3002`.

```bash
# .env.local
NEXT_PUBLIC_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_JOBS_URL=http://localhost:3001
NEXT_PUBLIC_PROFILE_URL=http://localhost:3003
NEXT_PUBLIC_NOTIFICATIONS_URL=http://localhost:3004
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
  --build-arg NEXT_PUBLIC_PROFILE_URL='' \
  --build-arg NEXT_PUBLIC_NOTIFICATIONS_URL='' \
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
        ├── /api/auth/*     → auth-service:3000
        ├── /api/jobs/*     → jobs-service:3001
        ├── /api/profile/*  → profile-service:3003
        ├── /api/matching/* → matching-service:3005
        └── /*              → web-app:3002 (Next.js)
```

---

## CI/CD

```
push to QA   → docker build (build-args injected) → docker push :qa    → ansible deploy QA (port 3002, behind Nginx)
merge master → docker build (build-args injected) → docker push :latest → ansible deploy PROD
```
