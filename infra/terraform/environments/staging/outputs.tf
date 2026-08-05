output "artifact_registry_repository" {
  description = "Artifact Registry repository name."
  value       = module.artifact_registry.repository_name
}

output "artifact_registry_image_prefix" {
  description = "Image prefix for immutable frontend-and-API container pushes."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${module.artifact_registry.repository_id}/cdl-react-app"
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
  description = "Runtime service account for the Cloud Run application."
  value       = google_service_account.runtime.email
}

output "migration_service_account_email" {
  description = "Service account for controlled migration, seed, and refresh jobs."
  value       = google_service_account.migration.email
}

output "runtime_secret_names" {
  description = "Secret Manager secret containers for staging runtime configuration."
  value       = module.runtime_secrets.secret_names
}

output "database_migration_job_name" {
  description = "Cloud Run migration job name when database jobs are enabled."
  value       = try(google_cloud_run_v2_job.database_migration[0].name, null)
}

output "synthetic_seed_job_name" {
  description = "Cloud Run deterministic synthetic seed job name when database jobs are enabled."
  value       = try(google_cloud_run_v2_job.synthetic_seed[0].name, null)
}

output "fpl_refresh_job_name" {
  description = "Cloud Run official FPL refresh job name when database jobs are enabled."
  value       = try(google_cloud_run_v2_job.fpl_refresh[0].name, null)
}

output "cloud_run_api_url" {
  description = "Single-service Cloud Run URL when enable_cloud_run is true."
  value       = try(module.cloud_run_api[0].service_uri, null)
}

output "frontend_asset_bucket_name" {
  description = "Private Cloud Storage bucket name for optional frontend assets."
  value       = module.frontend_assets.name
}

output "frontend_asset_bucket_url" {
  description = "Private gs:// URL for optional asset uploads. This is not a public website URL."
  value       = module.frontend_assets.url
}
