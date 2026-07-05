output "instance_name" {
  description = "Cloud SQL instance name."
  value       = google_sql_database_instance.this.name
}

output "connection_name" {
  description = "Cloud SQL instance connection name."
  value       = google_sql_database_instance.this.connection_name
}

output "database_name" {
  description = "Application database name."
  value       = google_sql_database.app.name
}
