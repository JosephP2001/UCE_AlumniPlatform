# messaging-service

Real-time messaging microservice for the UCE Alumni & Employment Platform.
Provides 1-to-1 conversations between users via REST (history, unread counts)
and WebSocket (live delivery).

---

## Stack

- **Runtime:** Node.js 24
- **Language:** TypeScript
- **Framework:** Express + `ws` (WebSocket)
- **Database:** MongoDB — `messaging_db` (collections `conversations`, `messages`)
- **Auth:** JWT (HS256), verified via `@uce-platform/auth-shared` conventions
  *(shared library migration pending — see Known Issues)*
- **Tests:** Jest + Supertest (service layer mocked)
- **Port:** `3008`

---

## ⚠️ Fixed — JWT payload field mismatch (`fix/messaging-userid-mismatch`)

Prior to this fix, the REST middleware, controller, and WebSocket handler all
read `req.user.userId` / `decoded.userId` from the JWT. The token actually
issued by `auth-service` only contains `id` — `userId` was always `undefined`.

**Impact in production:** every authenticated action silently broke —
`participants.includes(undefined)` returned `false`, causing `403 Access
denied` on `GET/POST /conversations/:id/messages`, and potentially creating
conversations with the literal string `"undefined"` as a participant via
`getOrCreateConversation`. Same bug was independently duplicated in the
WebSocket connection handler (`decoded.userId` there too).

Also removed an insecure fallback `process.env.JWT_SECRET || 'default_secret'`
in both the REST middleware and the WebSocket handler — the service now
fails closed (throws) if `JWT_SECRET` isn't injected, instead of silently
accepting tokens forged with a public default string.

**Fixed in:** `middleware/auth.middleware.ts`, `controllers/messaging.controller.ts`,
`websocket/websocket.ts`, `messaging.test.ts` (`makeToken` helper). All
`req.user.id` reads are converted with `String(...)` at the point of use to
match Mongoose's `string` participant/sender/recipient fields, without
touching the schema or existing data.

If auditing other services for similar issues, check for any `.userId` reads
against a JWT that only ever contains `.id` — this was found by manually
diffing the middleware across all 8 services against the actual payload
`auth-service` signs.

---

## Endpoints (REST)

All endpoints require header `Authorization: Bearer <token>` with a valid JWT.
No token / invalid token → `401`.

### `GET /health`
Public health check.

```json
{ "status": "ok", "service": "messaging-service", "timestamp": "2026-07-05T00:00:00.000Z" }
```

### `GET /conversations`
List the authenticated user's conversations, sorted by most recent activity.

### `POST /conversations`
Start or retrieve an existing conversation with another user.

```json
{ "recipientId": "42" }
```
`400` if `recipientId` is missing or equals the caller's own id.

### `GET /conversations/:conversationId/messages?page=1&limit=50`
Paginated message history. `403` if the caller isn't a participant, `404` if
the conversation doesn't exist.

### `POST /conversations/:conversationId/messages`
Send a message via REST (fallback path — WebSocket is preferred for real-time
delivery). Same `403`/`404` checks as above.

```json
{ "content": "hola" }
```

### `PATCH /conversations/:conversationId/read`
Marks all unread messages in the conversation (addressed to the caller) as read.

### `GET /unread`
Total unread message count across all of the caller's conversations.

---

## WebSocket

**Path:** `/ws` (mounted on the same HTTP server as the REST API — Nginx
proxies `/api/messaging/ws` → `/ws` on this container).

**Auth:** token passed as a query param, not a header (WebSocket handshakes
don't carry custom headers reliably through all proxies): `wss://<host>/api/messaging/ws?token=<JWT>`

**Client → Server messages:**
```json
{ "type": "ping" }
{ "type": "send_message", "conversationId": "c1", "content": "hola" }
{ "type": "mark_read", "conversationId": "c1" }
```

**Server → Client messages:**
```json
{ "type": "connected", "userId": "42" }
{ "type": "pong" }
{ "type": "new_message", "message": { ... } }
{ "type": "messages_read", "conversationId": "c1" }
{ "type": "error", "error": "Access denied" }
```

A heartbeat (`ping`/`pong`, 30s interval) detects and terminates dead
connections. Each user can have multiple simultaneous connections (e.g. two
tabs) — messages are broadcast to all of them via an in-memory `Map<userId, Set<WebSocket>>`.

> **Note:** this in-memory client map means WebSocket delivery only works
> within a single container instance — if this service is ever scaled to
> multiple replicas, a pub/sub layer (Redis, RabbitMQ) would be needed to
> fan out `sendToUser` across instances. Not an issue today since the service
> runs as a single container in both QA and PROD.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3008` | Service port |
| `NODE_ENV` | — | `production` in QA/PROD |
| `JWT_SECRET` | — | Shared secret to verify JWTs (required, no fallback) |
| `MONGO_URI` | `mongodb://mongodb:27017` | MongoDB connection string |
| `MONGO_DB` | `messaging_db` | Database name |
| `ALLOWED_ORIGINS` | — | Comma-separated list of allowed CORS origins |

---

## Structure