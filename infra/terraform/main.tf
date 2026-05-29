# GlucoCare — PostgreSQL on RDS (af-south-1 / Cape Town)
#
# Provisions a single-instance Postgres for the Firebase→Postgres migration.
# TLS-enforced, encrypted at rest, private (no public IP), automated backups,
# deletion protection on.
#
# This assumes an EXISTING VPC + private subnets (most teams have one). Pass
# their IDs in via variables. The app's security group ID is also passed in so
# we can scope ingress to just the application tier.
#
# Apply:
#   cd infra/terraform
#   cp terraform.tfvars.example terraform.tfvars   # fill in real values
#   terraform init
#   terraform plan
#   terraform apply
#
# The master password is generated and written to AWS Secrets Manager. The
# app_rw / app_ddl LOGIN roles are created out-of-band after first connect —
# see README.md (migrations manage their GRANTs, not their existence).

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Recommended: remote state in S3 + DynamoDB lock. Filled per-environment.
  # backend "s3" {
  #   bucket         = "glucocare-tfstate"
  #   key            = "rds/terraform.tfstate"
  #   region         = "af-south-1"
  #   dynamodb_table = "glucocare-tflock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "glucocare"
      Component   = "postgres"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ──────────────────────────────────────────────────────────────────────
# Master credential — generated, stored in Secrets Manager (never in tfvars)
# ──────────────────────────────────────────────────────────────────────

resource "random_password" "master" {
  length  = 32
  special = true
  # RDS disallows /, @, ", and space in the master password
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_master" {
  name        = "glucocare/${var.environment}/postgres/master"
  description = "RDS master credentials for GlucoCare ${var.environment}"
}

resource "aws_secretsmanager_secret_version" "db_master" {
  secret_id = aws_secretsmanager_secret.db_master.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    engine   = "postgres"
    host     = aws_db_instance.postgres.address
    port     = aws_db_instance.postgres.port
    dbname   = var.db_name
  })
}

# ──────────────────────────────────────────────────────────────────────
# Networking — DB subnet group + security group scoped to the app tier
# ──────────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "this" {
  name       = "glucocare-${var.environment}"
  subnet_ids = var.private_subnet_ids
  description = "Private subnets for GlucoCare RDS"
}

resource "aws_security_group" "db" {
  name        = "glucocare-${var.environment}-rds"
  description = "Postgres access for GlucoCare app tier"
  vpc_id      = var.vpc_id

  # Ingress: only from the application security group, on 5432.
  ingress {
    description     = "Postgres from app tier"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }

  # Optional break-glass: a bastion/admin CIDR for running migrations.
  dynamic "ingress" {
    for_each = var.admin_cidr_blocks
    content {
      description = "Postgres from admin CIDR (migrations/bastion)"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ──────────────────────────────────────────────────────────────────────
# Parameter group — force TLS, sane logging
# ──────────────────────────────────────────────────────────────────────

resource "aws_db_parameter_group" "this" {
  name        = "glucocare-${var.environment}-pg16"
  family      = "postgres16"
  description = "GlucoCare Postgres 16 params"

  # Reject any non-TLS connection.
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  # Log slow queries (>1s) for the migration + cutover bake period.
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  # Log every DDL — useful audit trail while we run migrations.
  parameter {
    name  = "log_statement"
    value = "ddl"
  }
}

# ──────────────────────────────────────────────────────────────────────
# The instance
# ──────────────────────────────────────────────────────────────────────

resource "aws_db_instance" "postgres" {
  identifier     = "glucocare-${var.environment}"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  db_name  = var.db_name
  username = var.master_username
  password = random_password.master.result
  port     = 5432

  # Storage — gp3 with autoscaling headroom.
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn # null → AWS-managed key

  # Networking — private only.
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = var.multi_az

  parameter_group_name = aws_db_parameter_group.this.name

  # Backups + maintenance — windows in UTC; chosen for low Kinshasa traffic (~03:00 WAT).
  backup_retention_period = var.backup_retention_days
  backup_window           = "01:00-02:00"
  maintenance_window      = "sun:02:30-sun:03:30"
  copy_tags_to_snapshot   = true

  # Safety.
  deletion_protection      = var.deletion_protection
  skip_final_snapshot      = false
  final_snapshot_identifier = "glucocare-${var.environment}-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"

  # Observability.
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  # Apply param-group / minor-version changes in the maintenance window, not immediately.
  apply_immediately           = false
  auto_minor_version_upgrade  = true

  lifecycle {
    # The final_snapshot_identifier embeds a timestamp() that changes every plan;
    # ignore it so plans aren't perpetually dirty.
    ignore_changes = [final_snapshot_identifier]
  }
}
