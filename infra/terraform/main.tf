resource "google_project_service" "required" {
  for_each = toset([
    "compute.googleapis.com",
    "dns.googleapis.com",
    "iam.googleapis.com",
    "iap.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_compute_network" "jenkins" {
  name                    = "packplay-jenkins"
  auto_create_subnetworks = false

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "jenkins" {
  name                     = "packplay-jenkins"
  ip_cidr_range            = "10.20.0.0/24"
  region                   = var.region
  network                  = google_compute_network.jenkins.id
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_10_MIN"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_address" "jenkins" {
  name   = "packplay-jenkins"
  region = var.region
}

resource "google_service_account" "jenkins" {
  account_id   = "packplay-jenkins"
  display_name = "PackPlay Jenkins VM"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "iap_access" {
  for_each = var.operator_members

  project = var.project_id
  role    = "roles/iap.tunnelResourceAccessor"
  member  = each.value
}

resource "google_project_iam_member" "os_admin_login" {
  for_each = var.operator_members

  project = var.project_id
  role    = "roles/compute.osAdminLogin"
  member  = each.value
}

resource "google_service_account_iam_member" "operator_service_account_use" {
  for_each = var.operator_members

  service_account_id = google_service_account.jenkins.name
  role               = "roles/iam.serviceAccountUser"
  member             = each.value
}

resource "google_compute_firewall" "web" {
  # checkov:skip=CKV_GCP_106:Public HTTP is required for Caddy's ACME HTTP challenge and redirects immediately to HTTPS.
  name    = "packplay-jenkins-web"
  network = google_compute_network.jenkins.name
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["packplay-jenkins"]
}

resource "google_compute_firewall" "ssh" {
  name    = "packplay-jenkins-ssh"
  network = google_compute_network.jenkins.name
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  source_ranges = var.ssh_source_ranges
  target_tags   = ["packplay-jenkins"]
}

resource "google_compute_disk" "jenkins_boot" {
  # checkov:skip=CKV_GCP_37:Google-managed encryption is intentional; CSEK would add an unrecoverable operator-held key dependency.
  name  = "packplay-jenkins-boot"
  type  = "pd-balanced"
  zone  = var.zone
  image = "debian-cloud/debian-12"
  size  = 40

  labels = {
    application = "packplay"
    component   = "jenkins"
  }
}

resource "google_compute_instance" "jenkins" {
  # checkov:skip=CKV_GCP_38:The attached managed disk intentionally uses Google-managed encryption rather than CSEK.
  # checkov:skip=CKV_GCP_40:A public IP is required for the public HTTPS Jenkins endpoint; SSH remains restricted to IAP.
  name                = "packplay-jenkins"
  machine_type        = var.machine_type
  zone                = var.zone
  tags                = ["packplay-jenkins"]
  deletion_protection = var.deletion_protection

  boot_disk {
    auto_delete = false
    source      = google_compute_disk.jenkins_boot.id
  }

  network_interface {
    subnetwork = google_compute_subnetwork.jenkins.id
    access_config {
      nat_ip = google_compute_address.jenkins.address
    }
  }

  service_account {
    email  = google_service_account.jenkins.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    enable-oslogin         = "TRUE"
    block-project-ssh-keys = "TRUE"
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }
}

resource "google_compute_resource_policy" "jenkins_backup" {
  name   = "packplay-jenkins-daily-backup"
  region = var.region

  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "03:00"
      }
    }

    retention_policy {
      max_retention_days    = var.snapshot_retention_days
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"
    }

    snapshot_properties {
      labels = {
        application = "packplay"
        component   = "jenkins"
      }
    }
  }
}

resource "google_compute_disk_resource_policy_attachment" "jenkins_backup" {
  name = google_compute_resource_policy.jenkins_backup.name
  disk = google_compute_disk.jenkins_boot.name
  zone = var.zone
}

resource "google_dns_record_set" "jenkins" {
  count        = var.dns_managed_zone == null ? 0 : 1
  name         = "${trimsuffix(var.jenkins_domain, ".")}."
  managed_zone = var.dns_managed_zone
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_address.jenkins.address]
}
