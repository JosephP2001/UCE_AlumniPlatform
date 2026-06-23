# Terraform

Provisions all AWS cloud resources for QA and PROD environments.

---

## QA Environment — `main.tf`

**AWS Account:** #2 (782987290346)  
**S3 Backend:** `uce-alumni-tfstate-qa`  
**Region:** `us-east-1`

| Resource | Name | Details |
|----------|------|---------|
| VPC | uce-qa-vpc | 10.0.0.0/16 |
| Public Subnet | uce-qa-public | 10.0.1.0/24 — us-east-1a |
| Private Subnet | uce-qa-private | 10.0.3.0/24 — us-east-1a |
| Internet Gateway | uce-qa-igw | Public subnet outbound |
| NAT Gateway | uce-qa-nat | Private subnet outbound |
| Security Group | bastion-qa | Port 22 open |
| Security Group | private-qa | VPC traffic only |
| Bastion Host | uce-qa-bastion | t3.micro, public subnet |
| EC2 | uce-qa-ec2-auth-jobs | t3.small, private subnet |

> **Note:** QA Bastion IP changes every session. Run `terraform apply -refresh-only` and update `QA_BASTION_IP` in GitHub Secrets each session.

**Commands:**
```bash
cd infra/terraform
terraform init
terraform apply
terraform apply -refresh-only   # refresh IP without changing infra
terraform output                # get current bastion_public_ip
```

---

## PROD Environment — `prod/main.tf`

**AWS Account:** #1 (471904521253)  
**S3 Backend:** `uce-alumni-tfstate`  
**Region:** `us-east-1`

| Resource | Name | Details |
|----------|------|---------|
| VPC | uce-prod-vpc | 10.0.0.0/16 |
| Public Subnet 1a | uce-prod-public-1a | 10.0.1.0/24 — us-east-1a |
| Public Subnet 1b | uce-prod-public-1b | 10.0.2.0/24 — us-east-1b |
| Private Subnet | uce-prod-private-1a | 10.0.3.0/24 — us-east-1a |
| Internet Gateway | uce-prod-igw | Public subnet outbound |
| NAT Gateway | uce-prod-nat | Private subnet outbound |
| **Elastic IP** | uce-prod-bastion-eip | **54.88.140.158** — fixed, never rotates |
| Bastion Host | uce-prod-bastion | t3.micro, public subnet |
| EC2 | uce-prod-ec2-auth-jobs | t3.small, 20GB gp3, private subnet |
| ELB | uce-prod-elb | Application LB, dual-AZ (us-east-1a + 1b) |
| Target Group | uce-prod-auth-tg | Port 3000, /health check |
| Target Group | uce-prod-jobs-tg | Port 3001, /health check |
| ELB Listener | HTTP:80 | `/jobs*` → jobs-tg · default → auth-tg |

> **Note:** PROD Bastion has a fixed Elastic IP `54.88.140.158` — no secret update needed between sessions.

**Commands:**
```bash
cd infra/terraform/prod
terraform init
terraform apply
terraform apply -refresh-only
terraform output
```

---

## Reconnecting Each Session

### QA (Account #2)

```bash
# 1. Set AWS Academy credentials
aws configure set aws_access_key_id ASIA...
aws configure set aws_secret_access_key ...
aws configure set aws_session_token ...
aws configure set region us-east-1

# 2. Get current Bastion IP
cd infra/terraform
terraform apply -refresh-only
terraform output  # → bastion_public_ip

# 3. Update QA_BASTION_IP in GitHub Secrets
# https://github.com/JosephP2001/UCE_AlumniPlatform/settings/secrets/actions
```

### PROD (Account #1)

```bash
# 1. Set AWS Academy credentials (Account #1)
aws configure set aws_access_key_id ASIA...
aws configure set aws_secret_access_key ...
aws configure set aws_session_token ...
aws configure set region us-east-1

# 2. Verify Elastic IP (always 54.88.140.158)
cd infra/terraform/prod
terraform apply -refresh-only
terraform output  # → bastion_eip = "54.88.140.158"

# No GitHub secret update needed
```
