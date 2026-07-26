output "deploy_service_account_email" {
  description = "Email address of the GitHub deploy service account."
  value       = google_service_account.github_deploy.email
}

output "workload_identity_provider_name" {
  description = "Full Workload Identity provider resource name."
  value       = google_iam_workload_identity_pool_provider.github.name
}
