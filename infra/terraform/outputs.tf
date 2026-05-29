output "db_endpoint" {
  description = "RDS endpoint host:port. Use to build DATABASE_URL_PG."
  value       = aws_db_instance.postgres.endpoint
}

output "db_address" {
  description = "RDS hostname (no port)."
  value       = aws_db_instance.postgres.address
}

output "db_port" {
  description = "RDS port."
  value       = aws_db_instance.postgres.port
}

output "db_name" {
  description = "Initial database name."
  value       = aws_db_instance.postgres.db_name
}

output "db_security_group_id" {
  description = "Security group attached to the RDS instance."
  value       = aws_security_group.db.id
}

output "master_secret_arn" {
  description = "Secrets Manager ARN holding the master credentials JSON."
  value       = aws_secretsmanager_secret.db_master.arn
}

# NB: the connection URLs for app_rw / app_ddl are NOT output here — those
# roles and their passwords are created out-of-band (see README) and stored in
# Secrets Manager separately, so they never land in Terraform state.
