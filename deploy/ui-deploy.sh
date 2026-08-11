#!/usr/bin/env bash
#
# Deploy the POP workflow UI to S3 + CloudFront.
#
# Architecture:
#
#   CloudFront distribution
#     ├── default behaviour        -> private S3 bucket (via Origin Access Control)
#     └── /pop/*, /health,         -> existing API Gateway (the Lambda API)
#         /docs*, /openapi.json
#
# Both the UI and the API are served from ONE CloudFront domain, so the browser
# sees a single origin and no CORS configuration is needed anywhere.
#
# The S3 bucket stays private — public access is blocked and only CloudFront can
# read it, via an Origin Access Control and a bucket policy scoped to this
# distribution's ARN.
#
# This script is idempotent: run it again to ship UI changes. It reuses the
# bucket, OAC and distribution if they already exist, then syncs and invalidates.
#
# Prereqs: aws CLI with working credentials, node + npm.
#
# Usage:
#   ./deploy/ui-deploy.sh [region]
#
set -euo pipefail

REGION="${1:-${REGION:-us-east-1}}"
API_NAME="${API_NAME:-pop-exposure-decision-api}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OAC_NAME="pop-workflow-ui-oac"
DIST_COMMENT="pop-workflow-ui"

echo "==> Region: ${REGION}"
aws sts get-caller-identity --region "${REGION}" >/dev/null || {
  echo "ERROR: no working AWS credentials. Run 'aws configure' first." >&2
  exit 1
}
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --region "${REGION}")"
BUCKET="${BUCKET:-pop-workflow-ui-${ACCOUNT_ID}}"

# --- 0. locate the existing API Gateway -------------------------------------
API_ID="$(aws apigatewayv2 get-apis --region "${REGION}" \
  --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text)"
if [ "${API_ID}" = "None" ] || [ -z "${API_ID}" ]; then
  echo "ERROR: API Gateway '${API_NAME}' not found. Deploy the API first" >&2
  echo "       (./deploy/lambda-deploy.sh && ./deploy/apigw-deploy.sh)." >&2
  exit 1
fi
API_DOMAIN="${API_ID}.execute-api.${REGION}.amazonaws.com"
echo "    API origin: ${API_DOMAIN}"

# --- 1. build the UI --------------------------------------------------------
echo "==> Building workflow UI..."
( cd "${ROOT}/web" && npm install --no-audit --no-fund --silent && npm run build )

# --- 2. private S3 bucket ---------------------------------------------------
echo "==> Ensuring S3 bucket ${BUCKET}..."
if ! aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  if [ "${REGION}" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "${BUCKET}" --region "${REGION}" >/dev/null
  else
    aws s3api create-bucket --bucket "${BUCKET}" --region "${REGION}" \
      --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null
  fi
  echo "    created"
else
  echo "    exists"
fi

# Defence in depth: the bucket is never public. CloudFront reads it via OAC.
aws s3api put-public-access-block --bucket "${BUCKET}" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" >/dev/null

# --- 3. CloudFront Origin Access Control ------------------------------------
echo "==> Ensuring Origin Access Control..."
OAC_ID="$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${OAC_NAME}'].Id | [0]" --output text 2>/dev/null || echo 'None')"
if [ "${OAC_ID}" = "None" ] || [ -z "${OAC_ID}" ]; then
  OAC_ID="$(aws cloudfront create-origin-access-control \
    --origin-access-control-config "Name=${OAC_NAME},Description=POP workflow UI,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
    --query 'OriginAccessControl.Id' --output text)"
  echo "    created ${OAC_ID}"
else
  echo "    reusing ${OAC_ID}"
fi

# --- 4. managed cache / origin-request policies ------------------------------
CACHE_OPTIMIZED="$(aws cloudfront list-cache-policies --type managed \
  --query "CachePolicyList.Items[?CachePolicy.CachePolicyConfig.Name=='Managed-CachingOptimized'].CachePolicy.Id | [0]" --output text)"
CACHE_DISABLED="$(aws cloudfront list-cache-policies --type managed \
  --query "CachePolicyList.Items[?CachePolicy.CachePolicyConfig.Name=='Managed-CachingDisabled'].CachePolicy.Id | [0]" --output text)"
ORP_ALLVIEWER="$(aws cloudfront list-origin-request-policies --type managed \
  --query "OriginRequestPolicyList.Items[?OriginRequestPolicy.OriginRequestPolicyConfig.Name=='Managed-AllViewerExceptHostHeader'].OriginRequestPolicy.Id | [0]" --output text)"

# --- 5. CloudFront distribution ---------------------------------------------
echo "==> Ensuring CloudFront distribution..."
DIST_ID="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='${DIST_COMMENT}'].Id | [0]" --output text 2>/dev/null || echo 'None')"

if [ "${DIST_ID}" = "None" ] || [ -z "${DIST_ID}" ]; then
  CONFIG_FILE="$(mktemp)"
  # One API behaviour per path the Express app serves. Caching is disabled on
  # these and all viewer data is forwarded, so POST bodies reach the Lambda intact.
  api_behaviour() {
    cat <<JSON
{
  "PathPattern": "$1",
  "TargetOriginId": "api-gw",
  "ViewerProtocolPolicy": "redirect-to-https",
  "AllowedMethods": {
    "Quantity": 7,
    "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
    "CachedMethods": { "Quantity": 2, "Items": ["GET","HEAD"] }
  },
  "Compress": true,
  "CachePolicyId": "${CACHE_DISABLED}",
  "OriginRequestPolicyId": "${ORP_ALLVIEWER}"
}
JSON
  }

  cat > "${CONFIG_FILE}" <<JSON
{
  "CallerReference": "pop-workflow-ui-$(date +%s)",
  "Comment": "${DIST_COMMENT}",
  "Enabled": true,
  "PriceClass": "PriceClass_100",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 2,
    "Items": [
      {
        "Id": "s3-ui",
        "DomainName": "${BUCKET}.s3.${REGION}.amazonaws.com",
        "OriginAccessControlId": "${OAC_ID}",
        "S3OriginConfig": { "OriginAccessIdentity": "" }
      },
      {
        "Id": "api-gw",
        "DomainName": "${API_DOMAIN}",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] }
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-ui",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET","HEAD"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET","HEAD"] }
    },
    "Compress": true,
    "CachePolicyId": "${CACHE_OPTIMIZED}"
  },
  "CacheBehaviors": {
    "Quantity": 4,
    "Items": [
      $(api_behaviour "/pop/*"),
      $(api_behaviour "/health"),
      $(api_behaviour "/docs*"),
      $(api_behaviour "/openapi.json")
    ]
  }
}
JSON

  DIST_ID="$(aws cloudfront create-distribution --distribution-config "file://${CONFIG_FILE}" \
    --query 'Distribution.Id' --output text)"
  rm -f "${CONFIG_FILE}"
  echo "    created ${DIST_ID}"
  NEW_DIST=1
else
  echo "    reusing ${DIST_ID}"
  NEW_DIST=0
fi

DIST_DOMAIN="$(aws cloudfront get-distribution --id "${DIST_ID}" --query 'Distribution.DomainName' --output text)"
DIST_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"

# --- 6. bucket policy: only this distribution may read -----------------------
echo "==> Applying bucket policy (CloudFront read-only)..."
aws s3api put-bucket-policy --bucket "${BUCKET}" --policy "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontRead",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET}/*",
    "Condition": { "StringEquals": { "AWS:SourceArn": "${DIST_ARN}" } }
  }]
}
JSON
)"

# --- 7. upload --------------------------------------------------------------
echo "==> Uploading UI to s3://${BUCKET}..."
# Hashed asset filenames can cache forever; index.html must not.
aws s3 sync "${ROOT}/web/dist" "s3://${BUCKET}" --delete \
  --exclude index.html --cache-control "public,max-age=31536000,immutable" --only-show-errors
aws s3 cp "${ROOT}/web/dist/index.html" "s3://${BUCKET}/index.html" \
  --cache-control "no-cache" --content-type "text/html" --only-show-errors

# --- 8. invalidate ----------------------------------------------------------
echo "==> Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths '/*' \
  --query 'Invalidation.Id' --output text >/dev/null

# --- done -------------------------------------------------------------------
echo ""
echo "==================================================================="
echo " Workflow UI:  https://${DIST_DOMAIN}/"
echo " API (same domain, no CORS):"
echo "               https://${DIST_DOMAIN}/pop/api/exposure-decision"
echo "               https://${DIST_DOMAIN}/health"
echo " Distribution: ${DIST_ID}    Bucket: ${BUCKET}"
echo "==================================================================="
if [ "${NEW_DIST}" = "1" ]; then
  echo ""
  echo "New distribution — allow 5-15 minutes for it to finish deploying."
  echo "Check status:  aws cloudfront get-distribution --id ${DIST_ID} --query 'Distribution.Status' --output text"
fi
