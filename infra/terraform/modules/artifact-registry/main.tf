resource "google_artifact_registry_repository" "this" {
  project       = var.project_id
  location      = var.region
  repository_id = var.repository_id
  description   = var.description
  format        = "DOCKER"
  labels        = var.labels

  cleanup_policy_dry_run = var.cleanup_policy_dry_run

  cleanup_policies {
    id     = "delete-untagged-after-retention"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = var.cleanup_untagged_older_than
    }
  }

  docker_config {
    immutable_tags = var.immutable_tags
  }
}
