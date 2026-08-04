#!/usr/bin/env bash
#
# Teardown everything lambda-deploy.sh created. Returns the account to $0.
#
# Usage: ./deploy/destroy.sh [region]
#
set -euo pipefail

FN_NAME="${FN_NAME:-pop-exposure-decision}"
REGION="${1:-${REGION:-us-east-1}}"
ROLE_NAME="${ROLE_NAME:-${FN_NAME}-exec-role}"
API_NAME="${API_NAME:-${FN_NAME}-api}"

echo "==> Deleting API Gateway HTTP API (if any)..."
API_ID="$(aws apigatewayv2 get-apis --region "${REGION}" \
  --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text 2>/dev/null || echo 'None')"
if [ "${API_ID}" != "None" ] && [ -n "${API_ID}" ]; then
  aws apigatewayv2 delete-api --api-id "${API_ID}" --region "${REGION}" 2>/dev/null || true
  echo "    deleted API ${API_ID}"
fi

echo "==> Deleting Function URL config (if any)..."
aws lambda delete-function-url-config --function-name "${FN_NAME}" --region "${REGION}" 2>/dev/null || true

echo "==> Deleting function..."
aws lambda delete-function --function-name "${FN_NAME}" --region "${REGION}" 2>/dev/null || true

echo "==> Detaching + deleting IAM role..."
aws iam detach-role-policy --role-name "${ROLE_NAME}" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true
aws iam delete-role --role-name "${ROLE_NAME}" 2>/dev/null || true

echo "==> Deleting CloudWatch log group..."
aws logs delete-log-group --log-group-name "/aws/lambda/${FN_NAME}" --region "${REGION}" 2>/dev/null || true

echo "==> Done. Account back to \$0 for this stack."
