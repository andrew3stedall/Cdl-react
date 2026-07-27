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
