# GlucoCare RDS (Terraform)

Provisions PostgreSQL 16 on RDS in **af-south-1 (Cape Town)** for the
Firebase→Postgres migration. TLS-enforced, encrypted at rest, private, with
automated backups and deletion protection.

## What it creates

- `aws_db_instance.postgres` — Postgres 16, gp3 storage (autoscaling), encrypted
- `aws_db_subnet_group` — across your private subnets
- `aws_security_group` — ingress 5432 from the app tier SG only (+ optional admin CIDR)
- `aws_db_parameter_group` — `rds.force_ssl=1`, DDL logging, slow-query logging
- `aws_secretsmanager_secret` — master credentials (generated, never in tfvars)

## Prerequisites

- An existing VPC with **≥2 private subnets** (RDS needs two AZs)
- The application tier's security group ID
- Terraform ≥ 1.6, AWS credentials with RDS/SecretsManager/EC2 perms
- af-south-1 is an **opt-in region** — enable it in your AWS account first

## Apply

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in vpc/subnets/app SG
terraform init
terraform plan        # review
terraform apply
```

Outputs `db_endpoint`, `db_address`, `master_secret_arn`.

## After apply — create the app roles (one-time, out-of-band)

Terraform provisions the instance and the **master** account only. The
least-privilege login roles the app and migrations use are created manually so
their passwords never enter Terraform state. Connect as master and run:

```sql
-- LOGIN roles
CREATE ROLE app_rw_login  LOGIN PASSWORD '<generated-1>';
CREATE ROLE app_ddl_login LOGIN PASSWORD '<generated-2>';

-- Grant them the non-login roles the migrations manage (migration 0005
-- creates app_rw / app_ddl and their GRANTs).
GRANT app_rw  TO app_rw_login;
GRANT app_ddl TO app_ddl_login;
```

Store both passwords in Secrets Manager (separate secrets), then set the app's
runtime env:

```
DATABASE_URL_PG=postgres://app_rw_login:<generated-1>@<db_address>:5432/glucosoin?sslmode=require
DATABASE_URL_PG_DDL=postgres://app_ddl_login:<generated-2>@<db_address>:5432/glucosoin?sslmode=require
```

## Run migrations

From a host that can reach the instance (app host, or a bastion in
`admin_cidr_blocks`):

```bash
cd server
DATABASE_URL_PG_DDL=... npm run migrate:up
```

`migrate:up` runs migrations 0001-0017 as `app_ddl_login`. Verify with the
Phase 1/2/3 manual checklists.

## Cost note (launch)

`db.t4g.small`, single-AZ, 20 GB gp3, 7-day backups ≈ low tens of USD/month in
af-south-1. Set `multi_az = true` and bump `instance_class` before production
scale-up.

## Teardown (non-production only)

```bash
terraform destroy
```

`deletion_protection = true` blocks this in production — flip it off via a
deliberate `terraform apply` first. A final snapshot is always taken.
