output "staging_project_number" {
  description = "Numeric staging project identifier."
  value       = data.google_project.staging.number
}

output "production_project_number" {
  description = "Numeric production project identifier."
  value       = data.google_project.production.number
}

output "staging_deploy_service_account" {
  description = "GitHub Actions staging deploy service account."
  value       = module.staging.deploy_service_account_email
}

output "production_deploy_service_account" {
  description = "GitHub Actions production deploy service account."
  value       = module.production.deploy_service_account_email
}

output "staging_workload_identity_provider" {
  description = "Provider resource name for the staging GitHub environment."
  value       = module.staging.workload_identity_provider_name
}

output "production_workload_identity_provider" {
  description = "Provider resource name for the production GitHub environment."
  value       = module.production.workload_identity_provider_name
}

output "terraform_state_bucket" {
  description = "GCS bucket used for remote Terraform state."
  value       = google_storage_bucket.terraform_state.name
}
