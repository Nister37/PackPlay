output "jenkins_ip" {
  description = "Static public IP for the Jenkins A record."
  value       = google_compute_address.jenkins.address
}

output "jenkins_url" {
  description = "Jenkins URL after DNS and Caddy certificate issuance complete."
  value       = "https://${var.jenkins_domain}/"
}

output "instance_name" {
  value = google_compute_instance.jenkins.name
}
