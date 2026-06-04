# UCE Alumni & Employment Platform

Nx monorepo (TypeScript) with two microservices deployed on AWS via automated CI/CD.

## Microservices

| Service | Port | Description |
|---------|------|-------------|
| `auth-service` | 3000 | GitHub OAuth 2.0 + JWT (access 15min / refresh 7d) |
| `jobs-service` | 3001 | Job listings CRUD — CQRS with PostgreSQL + Redis cache |

## Structure

```
uce-platform/
├── apps/
│   ├── auth-service/     # Node.js + TypeScript — 8 tests
│   └── jobs-service/     # Node.js + TypeScript — 6 tests
├── infra/
│   ├── terraform/        # QA + PROD
│   └── ansible/          # deploy-qa.yml
└── .github/workflows/
    ├── deploy-qa.yml
    └── deploy-prod.yml
```

## CI/CD

```
push → QA branch
  → npm test (14/14)
  → docker build + push (Docker Hub)
  → ansible deploy → EC2 QA (port 3000 / 3001)

approved PR → master
  → docker build + push
  → kubectl apply → EC2 PROD
```

## AWS Infrastructure

| Environment | EC2 | Access |
|-------------|-----|--------|
| QA | `uce-qa-ec2-auth-jobs` (private subnet) | via Bastion |
| PROD | `uce-prod-ec2-auth-jobs` (private subnet) | via Bastion — EIP `54.88.140.158` |

- Docker network: `uce-network`
- Terraform state: remote S3
- Secrets: injected via Ansible, never hardcoded

## Tests

```bash
# auth-service (8/8)
cd apps/auth-service && npm test

# jobs-service (6/6)
cd apps/jobs-service && npm test
```

## Health Checks

```bash
curl http://localhost:3000/health  # auth-service
curl http://localhost:3001/health  # jobs-service
```
