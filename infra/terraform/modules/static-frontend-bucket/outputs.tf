output "name" {
  description = "Cloud Storage bucket name."
  value       = google_storage_bucket.this.name
}

output "url" {
  description = "Google Storage URL for the private frontend asset bucket."
  value       = google_storage_bucket.this.url
}
