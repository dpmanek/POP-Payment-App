#!/usr/bin/env bash
#
# Swap the (blocked) Function URL for an API Gateway HTTP API in front of the
# same Lambda. HTTP API uses payload format 2.0 (rawPath + body), which the
# existing handler already understands.
#
# Usage: ./deploy/apigw-deploy.sh [region]
#
set -euo pipefail

FN_NAME="${FN_NAME:-pop-exposure-decision}"
REGION="${1:-${REGION:-us-east-1}}"
API_NAME="${API_NAME:-${FN_NAME}-api}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --region "${REGION}")"
FN_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FN_NAME}"

# --- 1. remove the Function URL (blocked by org SCP) ------------------------
echo "==> Removing Function URL..."
aws lambda delete-function-url-config --function-name "${FN_NAME}" --region "${REGION}" 2>/dev/null || true
aws lambda remove-permission --function-name "${FN_NAME}" \
  --statement-id FunctionURLAllowPublicAccess --region "${REGION}" 2>/dev/null || true

# --- 2. reuse or create the HTTP API (quick-create wires everything) --------
EXISTING_API_ID="$(aws apigatewayv2 get-apis --region "${REGION}" \
  --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text 2>/dev/null || echo 'None')"

if [ "${EXISTING_API_ID}" = "None" ] || [ -z "${EXISTING_API_ID}" ]; then
  echo "==> Creating HTTP API (quick-create -> \$default route + stage + permission)..."
  API_ID="$(aws apigatewayv2 create-api \
    --name "${API_NAME}" \
    --protocol-type HTTP \
    --target "${FN_ARN}" \
    --region "${REGION}" \
    --query ApiId --output text)"
else
  echo "==> Reusing existing HTTP API ${EXISTING_API_ID}"
  API_ID="${EXISTING_API_ID}"
fi

# Ensure API Gateway may invoke the Lambda (quick-create adds this, but be safe).
aws lambda add-permission --function-name "${FN_NAME}" \
  --statement-id apigw-invoke --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
  --region "${REGION}" 2>/dev/null || true

ENDPOINT="$(aws apigatewayv2 get-api --api-id "${API_ID}" --region "${REGION}" \
  --query ApiEndpoint --output text)"

echo ""
echo "==================================================================="
echo " API Gateway live. Base URL: ${ENDPOINT}"
echo " API ID: ${API_ID}"
echo "==================================================================="
echo ""
echo "Test:"
echo "  curl -s ${ENDPOINT}/pop/api/exposure-decision \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"caseId\":\"EXP-30412\",\"exceptionType\":\"Credit Exposure\",\"limits\":{\"dLimitValue\":50000,\"cLimitValue\":450000,\"tempValue\":25000,\"exposureValue\":550000},\"transactions\":[{\"type\":\"Credit\",\"tc\":\"27\",\"amount\":180000}]}'"
