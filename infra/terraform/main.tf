resource "google_project_service" "required" {
  for_each = toset([
    "compute.googleapis.com",
    "dns.googleapis.com",
    "iam.googleapis.com",
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
  name          = "packplay-jenkins"
  ip_cidr_range = "10.20.0.0/24"
  region        = var.region
  network       = google_compute_network.jenkins.id
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

resource "google_compute_firewall" "web" {
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

resource "google_compute_instance" "jenkins" {
  name         = "packplay-jenkins"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["packplay-jenkins"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 40
      type  = "pd-balanced"
    }
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
    enable-oslogin = "TRUE"
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

resource "google_dns_record_set" "jenkins" {
  count        = var.dns_managed_zone == null ? 0 : 1
  name         = "${trimsuffix(var.jenkins_domain, ".")}."
  managed_zone = var.dns_managed_zone
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_address.jenkins.address]
}
