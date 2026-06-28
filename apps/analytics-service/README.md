# analytics-service

Microservicio de métricas y reportes para la **UCE Alumni & Employment Platform**. Agrega datos de `jobs-service` (PostgreSQL) y `profile-service` (MongoDB) para exponer un panel de analítica administrativa.

## Stack

- **Runtime:** Node.js 24 (Alpine)
- **Lenguaje:** TypeScript
- **Framework:** Express
- **Logging:** Winston (JSON, consola)
- **Bases de datos (solo lectura):**
  - PostgreSQL — `jobs_db` (tablas `jobs`, `users`, `matches`)
  - MongoDB — `profiles_db` (colección `profiles`)
- **Auth:** JWT (HS256), verificación de `role: admin`
- **Tests:** Jest + Supertest (mocks de PG y Mongo)
- **Puerto:** `3007`

## Endpoints

Todos los endpoints requieren header `Authorization: Bearer <token>` con un JWT cuyo payload incluya `role: "admin"`. Sin token → `401`. Token válido sin rol admin → `403`.

### `GET /health`
Health check público, sin auth.

```json
{ "status": "ok", "service": "analytics-service", "timestamp": "2026-06-28T12:00:00.000Z" }
```

### `GET /analytics/summary`
Conteos totales agregados desde PostgreSQL y MongoDB en paralelo.

```json
{
  "data": {
    "total_jobs": 10,
    "total_users": 5,
    "total_matches": 20,
    "total_profiles": 8
  }
}
```

### `GET /analytics/jobs`
Distribución de jobs por tipo y serie diaria de los últimos 30 días.

```json
{
  "data": {
    "by_type": [{ "job_type": "remote", "total": "5" }],
    "by_day":  [{ "day": "2026-06-01", "total": "3" }]
  }
}
```

### `GET /analytics/matches`
Estadísticas agregadas de matches (promedio/máx/mín de score) y serie diaria de los últimos 30 días.

```json
{
  "data": {
    "stats": { "total_matches": "15", "avg_score": "78.50", "max_score": "95", "min_score": "40" },
    "by_day": [{ "day": "2026-06-01", "total": "5" }]
  }
}
```

### `GET /analytics/profiles`
Distribución de perfiles por carrera (top 10) y skills más frecuentes (top 10, parseadas desde campo `skills` separado por comas).

```json
{
  "data": {
    "by_career":  [{ "career": "CS", "total": 5 }],
    "top_skills": [{ "skill": "Python", "total": 12 }]
  }
}
```

## Variables de entorno

| Variable       | Default            | Descripción                              |
|----------------|---------------------|-------------------------------------------|
| `PORT`         | `3007`              | Puerto HTTP del servicio                  |
| `NODE_ENV`     | —                    | `production` en QA/PROD                   |
| `JWT_SECRET`   | —                    | Secreto para verificar el token (requerido) |
| `PG_HOST`      | `postgres`          | Host de PostgreSQL                        |
| `PG_PORT`      | `5432`              | Puerto de PostgreSQL                      |
| `PG_DATABASE`  | `jobs_db`           | Base de datos de PostgreSQL               |
| `PG_USER`      | `postgres`          | Usuario de PostgreSQL                     |
| `PG_PASSWORD`  | —                    | Password de PostgreSQL (requerido)        |
| `MONGO_URI`    | `mongodb://mongodb:27017` | URI de conexión a MongoDB           |
| `MONGO_DB`     | `profiles_db`       | Base de datos de MongoDB                  |

## Estructura

```
analytics-service/
├── src/
│   ├── index.ts                 # Entry point: Express app, /health, init PG + Mongo
│   ├── db/
│   │   ├── postgres.ts          # Pool de PostgreSQL (pgPool) + initPG()
│   │   └── mongo.ts             # Cliente MongoDB (getMongoDB) + initMongo()
│   ├── middleware/
│   │   └── auth.ts              # requireAdmin: valida JWT + role:admin
│   └── routes/
│       └── analytics.ts         # 4 endpoints: summary, jobs, matches, profiles
├── analytics.test.ts            # 8 tests (Jest + Supertest, PG/Mongo mockeados)
├── Dockerfile                   # Build multistage, usuario no-root, puerto 3007
├── package.json
└── tsconfig.json
```

## Correr en local

```bash
npm install
cp .env.example .env   # configurar PG_PASSWORD, JWT_SECRET, etc.
npm run dev             # ts-node-dev con hot reload
```

## Build y tests

```bash
npm run build   # compila a dist/ con tsc
npm test        # jest --forceExit --detectOpenHandles
npm start        # corre dist/index.js (requiere build previo)
```

## Docker

Build multistage (`deps` → `builder` → `runner`) sobre `node:24-alpine`, corre como usuario no-root (`appuser`).

```bash
docker build -t josephp2001/uce-analytics-service:qa .

docker run -d \
  --name analytics-service \
  --network uce-network \
  --restart always \
  -e NODE_ENV=production \
  -e PORT=3007 \
  -e JWT_SECRET="$JWT_SECRET" \
  -e PG_HOST=postgres \
  -e PG_PORT=5432 \
  -e PG_DATABASE=jobs_db \
  -e PG_USER=postgres \
  -e PG_PASSWORD="$PG_PASSWORD" \
  -e MONGO_URI=mongodb://mongodb:27017 \
  -e MONGO_DB=profiles_db \
  josephp2001/uce-analytics-service:qa
```

## Frontend

`/admin/analytics` (Next.js, solo accesible con `role: admin` en sesión) — dashboard con:
- 4 cards de resumen (jobs, users, matches, profiles totales)
- Barra de progreso: jobs por tipo
- Grid de estadísticas: matches (total, avg/max/min score)
- Barra de progreso: perfiles por carrera
- Tags de skills más frecuentes

Consume los 4 endpoints vía `/api/analytics/*` (proxy de Nginx) con el `access_token` guardado en `sessionStorage`.

## Notas de diseño

- Todas las queries son de **solo lectura** — el servicio no escribe en PG ni Mongo.
- Las 4 rutas de `/analytics/*` corren sus queries en paralelo con `Promise.all` para minimizar latencia.
- `requireAdmin` es el único middleware de auth: no hay JWKS ni refresh aquí, solo verificación local con `JWT_SECRET` compartido con el resto de servicios.
- `top_skills` asume que el campo `skills` en MongoDB es un string separado por comas (no un array) — si `profile-service` cambia ese esquema, este endpoint debe actualizarse.