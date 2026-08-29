resource "google_cloud_run_v2_job" "database_migration" {
  count = var.enable_database_jobs ? 1 : 0

  project             = var.project_id
  name                = "${var.name_prefix}-db-migrate"
  location            = var.region
  deletion_protection = true
  labels              = merge(local.common_labels, { component = "database-migration" })

  template {
    template {
      service_account = google_service_account.migration.email
      max_retries     = 0
      timeout         = "900s"

      volumes {
        name = "cloudsql"

        cloud_sql_instance {
          instances = [module.cloud_sql.connection_name]
        }
      }

      containers {
        image   = var.backend_image
        command = ["python"]
        args    = ["-m", "cdl_api.migrate"]

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        env {
          name  = "CDL_ENVIRONMENT"
          value = var.environment
        }

        env {
          name  = "CDL_REPOSITORY_MODE"
          value = "postgres"
        }

        env {
          name = "CDL_DATABASE_URL"

          value_source {
            secret_key_ref {
              secret  = module.runtime_secrets.secret_names["cdl-database-url"]
              version = "latest"
            }
          }
        }

      }
    }
  }

  lifecycle {
    precondition {
      condition     = var.backend_image != ""
      error_message = "Database jobs require an immutable backend_image digest."
    }
  }

  depends_on = [
    google_project_service.required,
    module.cloud_sql,
    google_project_iam_member.cloud_sql_client,
    google_secret_manager_secret_iam_member.migration_secret_access,
    google_secret_manager_secret_iam_member.migration_google_allowed_emails_access,
  ]
}

resource "google_cloud_run_v2_job" "synthetic_seed" {
  count = var.enable_database_jobs ? 1 : 0

  project             = var.project_id
  name                = "${var.name_prefix}-synthetic-seed"
  location            = var.region
  deletion_protection = true
  labels              = merge(local.common_labels, { component = "synthetic-seed" })

  template {
    template {
      service_account = google_service_account.migration.email
      max_retries     = 0
      timeout         = "900s"

      volumes {
        name = "cloudsql"

        cloud_sql_instance {
          instances = [module.cloud_sql.connection_name]
        }
      }

      containers {
        image   = var.backend_image
        command = ["python"]
        args    = ["-m", "cdl_api.seed_staging"]

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        env {
          name  = "CDL_ENVIRONMENT"
          value = var.environment
        }

        env {
          name  = "CDL_REPOSITORY_MODE"
          value = "postgres"
        }

        env {
          name  = "CDL_ALLOW_SYNTHETIC_STAGING_SEED"
          value = "true"
        }

        env {
          name = "CDL_DATABASE_URL"

          value_source {
            secret_key_ref {
              secret  = module.runtime_secrets.secret_names["cdl-database-url"]
              version = "latest"
            }
          }
        }

        env {
          name = "CDL_GOOGLE_ALLOWED_EMAILS"

          value_source {
            secret_key_ref {
              secret  = module.runtime_secrets.secret_names["cdl-google-allowed-emails"]
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    precondition {
      condition     = var.backend_image != ""
      error_message = "Database jobs require an immutable backend_image digest."
    }
  }

  depends_on = [
    google_project_service.required,
    module.cloud_sql,
    google_project_iam_member.cloud_sql_client,
    google_secret_manager_secret_iam_member.migration_secret_access,
  ]
}

resource "google_cloud_run_v2_job" "fpl_refresh" {
  count = var.enable_database_jobs ? 1 : 0

  project             = var.project_id
  name                = "${var.name_prefix}-fpl-refresh"
  location            = var.region
  deletion_protection = true
  labels              = merge(local.common_labels, { component = "official-fpl-refresh" })

  template {
    template {
      service_account = google_service_account.migration.email
      max_retries     = 0
      timeout         = "900s"

      volumes {
        name = "cloudsql"

        cloud_sql_instance {
          instances = [module.cloud_sql.connection_name]
        }
      }

      containers {
        image   = var.backend_image
        command = ["python"]
        args    = ["-m", "cdl_api.refresh_fpl"]

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        env {
          name  = "CDL_ENVIRONMENT"
          value = var.environment
        }

        env {
          name  = "CDL_REPOSITORY_MODE"
          value = "postgres"
        }

        env {
          name = "CDL_DATABASE_URL"

          value_source {
            secret_key_ref {
              secret  = module.runtime_secrets.secret_names["cdl-database-url"]
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    precondition {
      condition     = var.backend_image != ""
      error_message = "Official FPL refresh requires an immutable backend_image digest."
    }
  }

  depends_on = [
    google_project_service.required,
    module.cloud_sql,
    google_project_iam_member.cloud_sql_client,
    google_secret_manager_secret_iam_member.migration_secret_access,
  ]
}

resource "google_cloud_run_v2_job_iam_member" "fpl_refresh_scheduler_invoker" {
  count = var.enable_database_jobs && var.enable_scheduled_fpl_refresh ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.fpl_refresh[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.migration.email}"
}

resource "google_cloud_scheduler_job" "fpl_refresh" {
  count = var.enable_database_jobs && var.enable_scheduled_fpl_refresh ? 1 : 0

  project          = var.project_id
  region           = var.region
  name             = "${var.name_prefix}-fpl-refresh-schedule"
  description      = "Refresh official FPL data and settle due CDL selections and results."
  schedule         = "*/5 * * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "900s"

  retry_config {
    retry_count = 1
  }

  http_target {
    uri         = "https://run.googleapis.com/apis/run.googleapis.com/v1/projects/${var.project_id}/locations/${var.region}/jobs/${google_cloud_run_v2_job.fpl_refresh[0].name}:run"
    http_method = "POST"

    oauth_token {
      service_account_email = google_service_account.migration.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }

  depends_on = [google_cloud_run_v2_job_iam_member.fpl_refresh_scheduler_invoker]
}
