variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Google Cloud region."
  type        = string
  default     = "europe-central2"
}

variable "zone" {
  description = "Google Cloud zone."
  type        = string
  default     = "europe-central2-a"
}

variable "jenkins_domain" {
  description = "Public DNS name used by Jenkins and the ACME certificate."
  type        = string
}

variable "dns_managed_zone" {
  description = "Existing Cloud DNS managed-zone name. Leave null when DNS is managed elsewhere."
  type        = string
  default     = null
  nullable    = true
}

variable "ssh_source_ranges" {
  description = "CIDR ranges allowed to SSH. Default permits only Google IAP TCP forwarding."
  type        = list(string)
  default     = ["35.235.240.0/20"]
}

variable "machine_type" {
  description = "Jenkins VM size. e2-standard-2 is a practical starting point for sequential builds."
  type        = string
  default     = "e2-standard-2"
}
