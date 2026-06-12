# Infrastructure

Infrastructure-as-Code for the UCE Alumni & Employment Platform.

## Tools

| Tool | Purpose |
|------|---------|
| **Terraform** | Provisions AWS cloud resources (EC2, VPC, subnets, ELB, security groups, ASG) |
| **Ansible** | Configures machines after provisioning (installs Docker, deploys containers, injects secrets) |

## Environments

| Environment | AWS Account | Bastion IP | Domain | Orchestration |
|-------------|-------------|------------|--------|---------------|
| QA | Account #2 (782987290346) | `52.20.54.196` (Elastic IP) | — | Docker via Ansible |
| PROD | Account #1 (471904521253) | `54.88.140.158` (Elastic IP) | `josheponcepro2.distribuidauce.org` | Docker via Ansible + ELB |
| PROD (ELB) | Account #1 | ELB DNS | `josheponcepro1.distribuidauce.org` | Application Load Balancer |

QA and PROD are in **separate AWS accounts with no VPC peering** — a misconfiguration in QA cannot affect PROD.

Both QA and PROD Bastions have **Elastic IPs** — they do not change between AWS sessions.

## Directory Structure

```
infra/
├── terraform/
│   ├── main.tf          # QA environment (VPC, Bastion, EC2, EIP, DynamoDB lock)
│   ├── prod/
│   │   ├── main.tf      # PROD environment (VPC, ELB, ASG, Bastion, EIP, DynamoDB lock)
│   │   └── PROD.pub     # Public key for PROD key pair
│   └── README.md
├── ansible/
│   ├── deploy-qa.yml    # QA deployment playbook
│   ├── deploy-prod.yml  # PROD deployment playbook
│   └── README.md
└── nginx/
    └── nginx.conf       # Reverse proxy — routes /api/auth/*, /api/jobs/*, /api/profile/*, /*
```

## Security Design

- All service EC2 instances run in **private subnets** — no public IP
- Only the Bastion Host has a public IP (Elastic IP)
- Developer SSH: `Developer → Bastion → private EC2`
- User traffic (PROD): `Internet → ELB → private EC2`
- Secrets injected at deploy time via Ansible — **never hardcoded in code or config files**

## Nginx Routing

All traffic enters through Nginx on port 80:

| Path | Routes to |
|------|-----------|
| `/api/auth/*` | auth-service:3000 |
| `/api/jobs/*` | jobs-service:3001 |
| `/api/profile/*` | profile-service:3003 |
| `/*` | web-app:3002 |

## Terraform State

State files are stored remotely in S3 with DynamoDB locking to prevent concurrent applies:

| Environment | S3 Bucket | Key | DynamoDB Table |
|-------------|-----------|-----|----------------|
| QA | `uce-alumni-tfstate-qa` | `qa/terraform.tfstate` | `uce-tfstate-lock-qa` |
| PROD | `uce-alumni-tfstate` | `prod/terraform.tfstate` | `uce-tfstate-lock-prod` |