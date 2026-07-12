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

variable "operator_members" {
  description = "IAM members allowed to administer the VM through OS Login and IAP, such as user:name@example.com."
  type        = set(string)

  validation {
    condition = length(var.operator_members) > 0 && alltrue([
      for member in var.operator_members : can(regex("^(user|group|serviceAccount):[^[:space:]]+$", member))
    ])
    error_message = "Provide at least one user:, group:, or serviceAccount: IAM member."
  }
}

variable "deletion_protection" {
  description = "Protect the Jenkins VM from accidental deletion. Disable explicitly before an intentional destroy."
  type        = bool
  default     = true
}

variable "snapshot_retention_days" {
  description = "Number of days to retain daily Jenkins boot-disk snapshots."
  type        = number
  default     = 14

  validation {
    condition     = var.snapshot_retention_days >= 7 && var.snapshot_retention_days <= 365
    error_message = "Snapshot retention must be between 7 and 365 days."
  }
}
