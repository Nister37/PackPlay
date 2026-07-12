variable "project_id" {
  description = "Google Cloud project ID that will own the Terraform state bucket."
  type        = string
}

variable "region" {
  description = "Google Cloud region for the Terraform state bucket."
  type        = string
  default     = "europe-central2"
}

variable "state_bucket_name" {
  description = "Globally unique Google Cloud Storage bucket name for Terraform state."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$", var.state_bucket_name))
    error_message = "Use a valid globally unique Cloud Storage bucket name between 3 and 63 characters."
  }
}
