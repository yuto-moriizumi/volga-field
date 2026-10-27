#!/usr/bin/env bash
#
# Volga Field — Cloud Run デプロイ(CI とローカルの両方から呼ぶ)
#
#   scripts/deploy-cloudrun.sh --image asia-northeast1-docker.pkg.dev/PROJECT/volga/SERVICE:SHA
#   scripts/deploy-cloudrun.sh --source .   # 初回ブートストラップ(docker 不要 / Cloud Build)
#
# Cloud Run のフラグはここに一元化する。CI からもローカルからも同じ値を使う。
# 環境変数で上書き可能:
#   PROJECT_ID (default: volga-field-prod)
#   REGION     (default: asia-northeast1)
#   SERVICE_NAME (default: volga-field-server)
#   RUNTIME_SA (default: volga-runtime@$PROJECT_ID.iam.gserviceaccount.com)
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-volga-field-prod}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-volga-field-server}"
RUNTIME_SA="${RUNTIME_SA:-volga-runtime@${PROJECT_ID}.iam.gserviceaccount.com}"

usage() {
  cat <<EOF
usage: $0 --image IMAGE | --source [DIR]

  --image IMAGE   Artifact Registry のイメージをデプロイする(通常の CI 経路)
  --source [DIR]  gcloud run deploy --source でブートストラップする(既定: .)
EOF
}

MODE=""
IMAGE=""
SOURCE_DIR="."

case "${1:-}" in
  --image)
    MODE="image"
    IMAGE="${2:?--image requires an argument}"
    ;;
  --source)
    MODE="source"
    SOURCE_DIR="${2:-.}"
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

# Cloud Run のランタイム設定。ブートストラップと CI で完全に同一。
COMMON_FLAGS=(
  --project "$PROJECT_ID"
  --region "$REGION"
  --port 8080
  --allow-unauthenticated
  --timeout 3600
  --min-instances 0
  --max-instances 1
  --concurrency 20
  --cpu 1
  --memory 512Mi
  --cpu-boost
  --service-account "$RUNTIME_SA"
  --quiet
)

if [[ "$MODE" == "image" ]]; then
  echo "==> deploying image: $IMAGE"
  gcloud run deploy "$SERVICE_NAME" --image "$IMAGE" "${COMMON_FLAGS[@]}"
else
  echo "==> bootstrapping from source: $SOURCE_DIR (Cloud Build)"
  gcloud run deploy "$SERVICE_NAME" \
    --source "$SOURCE_DIR" \
    "${COMMON_FLAGS[@]}" \
    --labels=managed-by=scripts-deploy-cloudrun
fi

URL="$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"

echo "==> service URL: $URL"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### Cloud Run deployment"
    echo
    echo "- service: \`${SERVICE_NAME}\`"
    echo "- revision image: \`${IMAGE:-$SOURCE_DIR (source build)}\`"
    echo "- URL: ${URL}"
  } >> "$GITHUB_STEP_SUMMARY"
fi
