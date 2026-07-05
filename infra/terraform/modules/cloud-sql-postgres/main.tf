resource "google_sql_database_instance" "this" {
  project          = var.project_id
  name             = var.instance_name
  region           = var.region
  database_version = var.database_version

  deletion_protection = var.deletion_protection

  settings {
    tier              = var.database_tier
    availability_type = var.availability_type
    disk_size         = var.disk_size_gb
    disk_type         = "PD_SSD"

    backup_configuration {
      enabled                        = var.backup_enabled
      point_in_time_recovery_enabled = var.point_in_time_recovery
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
}

resource "google_sql_database" "app" {
  project  = var.project_id
  name     = var.database_name
  instance = google_sql_database_instance.this.name
}
