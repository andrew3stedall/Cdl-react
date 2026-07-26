resource "google_cloud_run_v2_service" "this" {
  project  = var.project_id
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = var.labels

  template {
    service_account = var.runtime_service_account_email

    dynamic "volumes" {
      for_each = var.cloud_sql_connection_name == null ? [] : [var.cloud_sql_connection_name]

      content {
        name = "cloudsql"

        cloud_sql_instance {
          instances = [volumes.value]
        }
      }
    }

    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }

    containers {
      image = var.image

      dynamic "volume_mounts" {
        for_each = var.cloud_sql_connection_name == null ? [] : [var.cloud_sql_connection_name]

        content {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "CDL_ENVIRONMENT"
        value = var.environment
      }

      env {
        name  = "CDL_REPOSITORY_MODE"
        value = var.repository_mode
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.allow_public_invoker ? 1 : 0

  project  = var.project_id
  location = google_cloud_run_v2_service.this.location
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
