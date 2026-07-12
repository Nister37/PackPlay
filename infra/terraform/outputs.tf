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

output "iap_ssh_command" {
  description = "Command for an authorized operator to connect through IAP."
  value       = "gcloud compute ssh ${google_compute_instance.jenkins.name} --project=${var.project_id} --zone=${var.zone} --tunnel-through-iap"
}
