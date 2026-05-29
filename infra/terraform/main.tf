# ─────────────────────────────────────────
# TERRAFORM BACKEND — S3 remote state
# ─────────────────────────────────────────
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "uce-alumni-tfstate-qa"
    key    = "qa/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
}

# ─────────────────────────────────────────
# VPC
# ─────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "uce-qa-vpc" }
}

# ─────────────────────────────────────────
# SUBNETS
# ─────────────────────────────────────────
resource "aws_subnet" "public_1a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  tags = { Name = "uce-qa-public-1a" }
}

resource "aws_subnet" "private_1a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "us-east-1a"
  tags = { Name = "uce-qa-private-1a" }
}

# ─────────────────────────────────────────
# INTERNET GATEWAY
# ─────────────────────────────────────────
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = { Name = "uce-qa-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = { Name = "uce-qa-public-rt" }
}

resource "aws_route_table_association" "public_1a" {
  subnet_id      = aws_subnet.public_1a.id
  route_table_id = aws_route_table.public.id
}

# ─────────────────────────────────────────
# SECURITY GROUPS
# ─────────────────────────────────────────
resource "aws_security_group" "sg_bastion" {
  name        = "uce-bastion"
  description = "SSH access to bastion host"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "uce-bastion" }
}

resource "aws_security_group" "sg_private" {
  name        = "uce-private"
  description = "Private EC2 instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/16"]
  }
  ingress {
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_bastion.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "uce-private" }
}

# ─────────────────────────────────────────
# KEY PAIR
# ─────────────────────────────────────────
data "aws_key_pair" "qa_key" {
  key_name = "QA"
}

# ─────────────────────────────────────────
# BASTION HOST
# ─────────────────────────────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*ubuntu*26.04*amd64*"]
  }
}

resource "aws_instance" "bastion" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public_1a.id
  key_name               = data.aws_key_pair.qa_key.key_name
  vpc_security_group_ids = [aws_security_group.sg_bastion.id]
  tags = { Name = "uce-qa-bastion" }
}

# ─────────────────────────────────────────
# EC2 — QA Auth + Jobs service
# ─────────────────────────────────────────
resource "aws_instance" "qa_auth_jobs" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.private_1a.id
  key_name               = data.aws_key_pair.qa_key.key_name
  vpc_security_group_ids = [aws_security_group.sg_private.id]

  user_data = <<-EOF
    #!/bin/bash
    apt update -y
    apt install -y ca-certificates curl gnupg git
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt update -y
    apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ubuntu
  EOF

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = { Name = "uce-qa-ec2-auth-jobs" }
}

# ─────────────────────────────────────────
# OUTPUTS
# ─────────────────────────────────────────
output "bastion_public_ip" {
  value = aws_instance.bastion.public_ip
}

output "qa_auth_jobs_private_ip" {
  value = aws_instance.qa_auth_jobs.private_ip
}