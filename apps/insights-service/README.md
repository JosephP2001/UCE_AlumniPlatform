# insights-service

Tenth microservice + AI requirement. Reads aggregated metrics from `analytics-service`
and uses an LLM (Google Gemini, REST API — free tier) to generate a narrative executive summary.

## Responsibility (Single Responsibility)

`analytics-service` calculates metrics. `insights-service` interprets them. They do not share
aggregation code — the separation is intentional (see `Final_Project_Plan.md`, section 2).

## Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Liveness check |
| GET | `/api/insights/summary` | Admin (JWT via `@uce-platform/auth-shared`) | Returns `{ summary, generatedAt, cached }` |

## Internal Flow

1. Checks Redis (`insights:summary`, configurable TTL, default 1 hour).
2. If a cached value exists → responds immediately (`cached: true`), without contacting Analytics or the LLM.
3. If no cache exists → calls `GET {ANALYTICS_SERVICE_URL}/api/analytics/summary`
   forwarding the original request's `Authorization` header.
4. Sends the metrics as context to Gemini (REST API, `generateContent`), requesting
   an executive summary plus key findings.
5. Caches the result and responds (`cached: false`).

## Environment Variables

See `.env.example`. `GEMINI_API_KEY` must be provided through GitHub Secrets → Ansible →
container environment variables, just like the rest of the project's secrets — never hardcoded.

It is a **shared** secret between QA and PROD (same pattern as `JWT_SECRET`,
`PG_PASSWORD`, and `RABBITMQ_PASSWORD`), not one using a `QA_` or `PROD_` prefix.

The API key can be obtained for free from https://aistudio.google.com (Get API Key) through
the Google AI Studio free tier, with no credit card required. This is sufficient for the
service due to the 1-hour Redis cache (at most ~24 LLM requests per day in the worst-case scenario).

## Pending Integration Steps When Copying to the Monorepo

- [ ] Move the service to `apps/insights-service/`.
- [ ] In `src/middleware/auth.ts`, remove the development fallback and keep only the
      real import from `@uce-platform/auth-shared`.
- [ ] Adding `"insights-service": "*"` is not applicable — this service *consumes*
      `auth-shared`; it does not publish it.
- [ ] Register `apps/insights-service/package.json` as part of the workspace
      (already covered if `workspaces` includes `apps/*`).
- [ ] Add `GEMINI_API_KEY` to GitHub Secrets — **only once**, as a shared secret for QA and PROD.
- [ ] Add an upstream and `location /api/insights/` block to `nginx.conf`.
- [ ] Add the container and environment variable to both Ansible playbooks.
- [ ] Add the `build-insights` job to `deploy-qa.yml` and `deploy-prod.yml`
      (see the snippets already provided in this chat).
- [ ] Update `PonceJ_FinalProject_v4.docx`: add a new row to Table 5.3;
      update the technology stack to include Google Gemini as the AI provider.

## Tests

```bash
npm test
```

Five test cases:

1. 401 Unauthorized when no authentication token is provided.
2. Cache hit (does not call Analytics or the LLM).
3. Cache miss (calls both Analytics and the LLM, then caches the result).
4. Returns 502 if `analytics-service` fails.
5. Returns 502 if the LLM request fails.