output "secret_names" {
  description = "Created Secret Manager secret names keyed by secret ID."
  value = {
    for secret_id, secret in google_secret_manager_secret.this :
    secret_id => secret.secret_id
  }
}
