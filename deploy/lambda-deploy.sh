#!/usr/bin/env bash
#
# One-shot deploy: POP exposure-decision -> AWS Lambda + public Function URL.
#
# Prereqs (you set these up; this script never handles your secrets):
#   - aws CLI configured with a working identity (aws sts get-caller-identity)
#   - node + npm (to build), zip
#
# Usage:
#   ./deploy/lambda-deploy.sh [region]
#   REGION=us-east-1 ./deploy/lambda-deploy.sh
#
set -euo pipefail

# --- config -----------------------------------------------------------------
FN_NAME="${FN_NAME:-pop-exposure-decision}"
REGION="${1:-${REGION:-us-east-1}}"
ROLE_NAME="${ROLE_NAME:-${FN_NAME}-exec-role}"
RUNTIME="nodejs20.x"
HANDLER="dist/aws/lambda-app.handler"
MEMORY="${MEMORY:-256}"
TIMEOUT="${TIMEOUT:-10}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_ZIP="${ROOT}/deploy/function.zip"

echo "==> Region: ${REGION}   Function: ${FN_NAME}"
aws sts get-caller-identity --region "${REGION}" >/dev/null || {
  echo "ERROR: no working AWS credentials. Run 'aws configure' first." >&2
  exit 1
}
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --region "${REGION}")"

# --- 1. build ---------------------------------------------------------------
echo "==> Building TypeScript..."
cd "${ROOT}"
npm run build

# Build the workflow UI too, if it is present. Express serves it at /ui.
if [ -f "${ROOT}/web/package.json" ]; then
  echo "==> Building workflow UI..."
  ( cd "${ROOT}/web" && npm install --no-audit --no-fund --silent && npm run build )
fi

# --- 2. package (dist + UI + production node_modules) -----------------------
echo "==> Packaging function.zip..."
rm -rf "${ROOT}/deploy/pkg" "${BUILD_ZIP}"
mkdir -p "${ROOT}/deploy/pkg"
cp -R "${ROOT}/dist" "${ROOT}/deploy/pkg/dist"
cp "${ROOT}/package.json" "${ROOT}/deploy/pkg/package.json"
if [ -d "${ROOT}/web/dist" ]; then
  mkdir -p "${ROOT}/deploy/pkg/web"
  cp -R "${ROOT}/web/dist" "${ROOT}/deploy/pkg/web/dist"
  echo "    included workflow UI (/ui)"
fi
( cd "${ROOT}/deploy/pkg" && npm install --omit=dev --no-audit --no-fund --silent )
( cd "${ROOT}/deploy/pkg" && zip -qr "${BUILD_ZIP}" . )
echo "    $(du -h "${BUILD_ZIP}" | cut -f1) packaged"

# --- 3. IAM execution role --------------------------------------------------
echo "==> Ensuring IAM execution role..."
if ! aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  aws iam create-role --role-name "${ROLE_NAME}" \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
    }' >/dev/null
  aws iam attach-role-policy --role-name "${ROLE_NAME}" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "    created ${ROLE_NAME}, waiting for propagation..."
  sleep 10
else
  echo "    role ${ROLE_NAME} exists"
fi
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# --- 4. create or update the function ---------------------------------------
ENV_VARS="Variables={NODE_ENV=production,LOG_LEVEL=info,CREDIT_CEILING=300000,DEBIT_CEILING=200000,MIN_CONFIDENCE=0.5}"
if aws lambda get-function --function-name "${FN_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  echo "==> Updating existing function code + config..."
  aws lambda update-function-code --function-name "${FN_NAME}" \
    --zip-file "fileb://${BUILD_ZIP}" --region "${REGION}" >/dev/null
  aws lambda wait function-updated --function-name "${FN_NAME}" --region "${REGION}"
  aws lambda update-function-configuration --function-name "${FN_NAME}" \
    --handler "${HANDLER}" --runtime "${RUNTIME}" --memory-size "${MEMORY}" \
    --timeout "${TIMEOUT}" --environment "${ENV_VARS}" --region "${REGION}" >/dev/null
else
  echo "==> Creating function..."
  aws lambda create-function --function-name "${FN_NAME}" \
    --runtime "${RUNTIME}" --handler "${HANDLER}" --role "${ROLE_ARN}" \
    --zip-file "fileb://${BUILD_ZIP}" --memory-size "${MEMORY}" \
    --timeout "${TIMEOUT}" --environment "${ENV_VARS}" --region "${REGION}" >/dev/null
fi
aws lambda wait function-updated --function-name "${FN_NAME}" --region "${REGION}"

# --- 5. public Function URL -------------------------------------------------
echo "==> Ensuring public Function URL..."
if ! aws lambda get-function-url-config --function-name "${FN_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  aws lambda create-function-url-config --function-name "${FN_NAME}" \
    --auth-type NONE --region "${REGION}" >/dev/null
  aws lambda add-permission --function-name "${FN_NAME}" \
    --statement-id FunctionURLAllowPublicAccess --action lambda:InvokeFunctionUrl \
    --principal '*' --function-url-auth-type NONE --region "${REGION}" >/dev/null 2>&1 || true
fi
URL="$(aws lambda get-function-url-config --function-name "${FN_NAME}" \
  --query FunctionUrl --output text --region "${REGION}")"

# --- done -------------------------------------------------------------------
echo ""
echo "==================================================================="
echo " Deployed. Live URL: ${URL}"
echo "==================================================================="
echo ""
echo "Test it:"
echo "  curl -s ${URL}pop/api/exposure-decision \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"caseId\":\"EXP-30412\",\"exceptionType\":\"Credit Exposure\",\"limits\":{\"dLimitValue\":50000,\"cLimitValue\":450000,\"tempValue\":25000,\"exposureValue\":550000},\"transactions\":[{\"type\":\"Credit\",\"tc\":\"27\",\"amount\":180000}]}'"
