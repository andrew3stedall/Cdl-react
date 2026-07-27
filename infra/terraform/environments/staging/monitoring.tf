locals {
  monitoring_labels = {
    application = "cdl-react"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_monitoring_alert_policy" "cloud_sql_cpu_utilization" {
  project               = var.project_id
  display_name          = "${var.name_prefix} Cloud SQL sustained CPU"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.monitoring_notification_channels
  severity              = "WARNING"

  conditions {
    display_name = "Cloud SQL CPU utilization above 80 percent for 5 minutes"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloudsql_database\"",
        "resource.labels.database_id=\"${var.project_id}:${local.database_instance_name}\"",
        "metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\"",
      ])
      duration                = "300s"
      comparison              = "COMPARISON_GT"
      threshold_value         = 0.8
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  documentation {
    mime_type = "text/markdown"
    content   = "Cloud SQL CPU has remained above 80% for five minutes. Check active queries, connection pressure, locks, and instance sizing before changing capacity."
  }

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = local.monitoring_labels

  depends_on = [
    google_project_service.required,
    module.cloud_sql,
  ]
}

resource "google_monitoring_alert_policy" "cloud_sql_error_logs" {
  project               = var.project_id
  display_name          = "${var.name_prefix} Cloud SQL error logs"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.monitoring_notification_channels
  severity              = "ERROR"

  conditions {
    display_name = "Cloud SQL severity ERROR or higher"

    condition_matched_log {
      filter = join("\n", [
        "resource.type=\"cloudsql_database\"",
        "resource.labels.database_id=\"${var.project_id}:${local.database_instance_name}\"",
        "severity>=ERROR",
      ])
    }
  }

  documentation {
    mime_type = "text/markdown"
    content   = "Cloud SQL emitted an ERROR-or-higher log entry. Inspect the matching log, database availability, recent migrations, connection failures, and storage state."
  }

  alert_strategy {
    auto_close = "1800s"

    notification_rate_limit {
      period = "900s"
    }
  }

  user_labels = local.monitoring_labels

  depends_on = [
    google_project_service.required,
    module.cloud_sql,
  ]
}

resource "google_monitoring_alert_policy" "cloud_run_error_logs" {
  count = var.enable_cloud_run ? 1 : 0

  project               = var.project_id
  display_name          = "${var.name_prefix} Cloud Run error logs"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.monitoring_notification_channels
  severity              = "ERROR"

  conditions {
    display_name = "Cloud Run API severity ERROR or higher"

    condition_matched_log {
      filter = join("\n", [
        "resource.type=\"cloud_run_revision\"",
        "resource.labels.project_id=\"${var.project_id}\"",
        "resource.labels.location=\"${var.region}\"",
        "resource.labels.service_name=\"${local.api_service_name}\"",
        "severity>=ERROR",
      ])
    }
  }

  documentation {
    mime_type = "text/markdown"
    content   = "The staging Cloud Run API emitted an ERROR-or-higher log entry. Inspect the matching revision logs, request failures, startup state, database connectivity, and recent deployment changes."
  }

  alert_strategy {
    auto_close = "1800s"

    notification_rate_limit {
      period = "900s"
    }
  }

  user_labels = local.monitoring_labels

  depends_on = [
    google_project_service.required,
    module.cloud_run_api,
  ]
}
