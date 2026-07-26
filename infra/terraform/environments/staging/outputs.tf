output "artifact_registry_repository" {
  description = "Artifact Registry repository name."
  value       = module.artifact_registry.repository_name
}

output "artifact_registry_image_prefix" {
  description = "Image prefix for backend container pushes."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${module.artifact_registry.repository_id}/cdl-react-api"
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name."
  value       = module.cloud_sql.connection_name
}

output "cloud_sql_database_name" {
  description = "Created staging database name."
  value       = module.cloud_sql.database_name
}

output "runtime_service_account_email" {
  description = "Runtime service account for the Cloud Run API."
  value       = google_service_account.runtime.email
}

output "migration_service_account_email" {
  description = "Reserved service account for migration jobs."
  value       = google_service_account.migration.email
}

output "runtime_secret_names" {
  description = "Secret Manager secret names available to runtime and migration identities."
  value       = module.runtime_secrets.secret_names
}

output "cloud_run_api_url" {
  description = "Cloud Run API URL when enable_cloud_run is true."
  value       = try(module.cloud_run_api[0].service_uri, null)
}
