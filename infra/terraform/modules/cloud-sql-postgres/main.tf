resource "google_sql_database_instance" "this" {
  project          = var.project_id
  name             = var.instance_name
  region           = var.region
  database_version = var.database_version

  deletion_protection = var.deletion_protection

  settings {
    tier                        = var.database_tier
    availability_type           = var.availability_type
    deletion_protection_enabled = var.deletion_protection
    disk_autoresize             = true
    disk_autoresize_limit       = var.disk_autoresize_limit_gb
    disk_size                   = var.disk_size_gb
    disk_type                   = "PD_SSD"
    user_labels                 = var.labels

    backup_configuration {
      enabled                        = var.backup_enabled
      location                       = var.backup_location
      point_in_time_recovery_enabled = var.point_in_time_recovery
      start_time                     = var.backup_start_time
      transaction_log_retention_days = var.transaction_log_retention_days

      backup_retention_settings {
        retained_backups = var.retained_backups
        retention_unit   = "COUNT"
      }
    }

    # Keep public IP enabled for the initial scaffold so Terraform does not require
    # a VPC/private-service-access dependency. No authorized networks are declared.
    ip_configuration {
      ipv4_enabled = true
    }

    insights_config {
      query_insights_enabled = true
    }
  }

  lifecycle {
    ignore_changes = [settings[0].disk_size]
  }
}

resource "google_sql_database" "app" {
  project  = var.project_id
  name     = var.database_name
  instance = google_sql_database_instance.this.name
}
