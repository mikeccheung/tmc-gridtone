locals {
  role_name = "gridtone-deploy-oidc"
}

# Trust policy: allow GitHub Actions (this repo/branch) via OIDC to assume the role.
data "aws_iam_policy_document" "github_oidc_trust" {
  statement {
    effect = "Allow"

    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn]
    }

    actions = ["sts:AssumeRoleWithWebIdentity"]

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Allow only this repo and branch. Adjust to use environments if you prefer.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_owner}/${var.github_repo}:ref:refs/heads/${var.github_branch}"
      ]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = local.role_name
  assume_role_policy = data.aws_iam_policy_document.github_oidc_trust.json
  description        = "GitHub Actions OIDC role for GridTone deploys"
  max_session_duration = 3600
}

# Least-privilege: S3 upload to the one bucket
data "aws_iam_policy_document" "s3_deploy" {
  statement {
    sid     = "BucketList"
    effect  = "Allow"
    actions = ["s3:ListBucket"]
    resources = [
      "arn:aws:s3:::${var.bucket_name}"
    ]
  }

  statement {
    sid     = "BucketObjectsRW"
    effect  = "Allow"
    actions = [
      "s3:PutObject",
      "s3:PutObjectAcl",
      "s3:DeleteObject",
      "s3:DeleteObjectVersion",
      "s3:GetObject",
      "s3:GetObjectVersion"
    ]
    resources = [
      "arn:aws:s3:::${var.bucket_name}/*"
    ]
  }
}

resource "aws_iam_policy" "s3_deploy" {
  name        = "GridtoneS3Deploy"
  description = "Allow writing build artifacts to ${var.bucket_name}"
  policy      = data.aws_iam_policy_document.s3_deploy.json
}

# Least-privilege: CloudFront invalidation for the one distribution
data "aws_iam_policy_document" "cloudfront_invalidation" {
  statement {
    sid     = "InvalidateGridtone"
    effect  = "Allow"
    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation",
      "cloudfront:ListInvalidations"
    ]
    resources = [
      "arn:aws:cloudfront::${var.account_id}:distribution/${var.cloudfront_distribution_id}"
    ]
  }

  # Optional: allow list for diagnostics (resource is * by design)
  statement {
    sid     = "ListCFForDiagnostics"
    effect  = "Allow"
    actions = ["cloudfront:ListDistributions"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "cloudfront_invalidation" {
  name        = "GridtoneCloudFrontInvalidation"
  description = "Allow invalidations on distribution ${var.cloudfront_distribution_id}"
  policy      = data.aws_iam_policy_document.cloudfront_invalidation.json
}

resource "aws_iam_role_policy_attachment" "attach_s3" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.s3_deploy.arn
}

resource "aws_iam_role_policy_attachment" "attach_cf" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.cloudfront_invalidation.arn
}

output "deploy_role_arn" {
  value       = aws_iam_role.deploy.arn
  description = "Role to put in your GitHub Actions 'role-to-assume'"
}
