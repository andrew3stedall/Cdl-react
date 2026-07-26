resource "google_storage_bucket" "this" {
  project  = var.project_id
  name     = var.bucket_name
  location = var.location

  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true
  labels                      = var.labels

  versioning {
    enabled = true
  }
}
