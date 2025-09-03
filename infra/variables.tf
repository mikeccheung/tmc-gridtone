variable "aws_region" {
  type        = string
  description = "AWS region (CloudFront is global, but we set this for IAM/S3)."
  default     = "us-east-1"
}

variable "account_id" {
  type        = string
  description = "Your AWS account id."
  default     = "909704573646"
}

variable "bucket_name" {
  type        = string
  description = "S3 bucket used by the PWA deploy."
  default     = "909704573646-tmc-gridtone"
}

variable "cloudfront_distribution_id" {
  type        = string
  description = "GridTone CloudFront distribution id."
  default     = "EMD7EYKSPLBXC"
}

variable "github_owner" {
  type        = string
  description = "GitHub org/user that owns the repo."
}

variable "github_repo" {
  type        = string
  description = "GitHub repo name (no owner)."
}

variable "github_branch" {
  type        = string
  description = "Branch allowed to assume the deploy role."
  default     = "main"
}

# If your account already has the GitHub OIDC provider (it does), use this ARN.
variable "github_oidc_provider_arn" {
  type        = string
  description = "Existing IAM OIDC provider ARN for token.actions.githubusercontent.com."
  default     = "arn:aws:iam::909704573646:oidc-provider/token.actions.githubusercontent.com"
}
