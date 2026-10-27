#!/usr/bin/env bash
#
# Volga Field — GCP 基盤セットアップ(冪等・再実行可能)
#
#   scripts/setup-gcp.sh
#
# やること:
#   * GCP プロジェクト作成(volga-field-prod が使えなければ -XXXX を付与)
#   * 請求先アカウントのリンク
#   * 必要な API の有効化
#   * Artifact Registry (Docker, asia-northeast1)
#   * デプロイ用 SA (github-deployer) / ランタイム用 SA (volga-runtime)
#   * Workload Identity Federation (GitHub OIDC)
#
# 何度実行しても安全(既存リソースは describe してから作成する)。
# 既存の他プロジェクト(bottlist など)には一切触れない。
set -euo pipefail

BILLING_ACCOUNT="${BILLING_ACCOUNT:-01266A-F4EA26-685168}"
REGION="${REGION:-asia-northeast1}"
AR_REPOSITORY="${AR_REPOSITORY:-volga}"
SERVICE_NAME="${SERVICE_NAME:-volga-field-server}"
PROJECT_BASE="${PROJECT_BASE:-volga-field-prod}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-yuto-moriizumi/volga-field}"

POOL_ID="github"
PROVIDER_ID="github-oidc"
DEPLOYER_SA_ID="github-deployer"
RUNTIME_SA_ID="volga-runtime"

APIS=(
  run.googleapis.com
  artifactregistry.googleapis.com
  iam.googleapis.com
  iamcredentials.googleapis.com
  cloudresourcemanager.googleapis.com
  cloudbuild.googleapis.com
  storage.googleapis.com
)

log() { printf '\n==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }

project_available() {
  # 存在し、かつ自分が参照できるプロジェクトだけを「利用可能」とみなす。
  gcloud projects describe "$1" --format='value(projectId)' >/dev/null 2>&1
}

create_project() {
  # プロジェクト ID はグローバル一意。作れなければ空文字を返す。
  local candidate="$1"
  if gcloud projects create "$candidate" \
    --name="Volga Field" \
    --labels=app=volga-field,managed-by=scripts-setup-gcp \
    >/dev/null 2>&1; then
    echo "$candidate"
    return 0
  fi
  echo ""
}

# ---------------------------------------------------------------------------
log "プロジェクトの選択/作成"
PROJECT=""
if [[ -n "${PROJECT_ID:-}" ]]; then
  # 明示指定があればそれを使う(無ければ作る)。
  if project_available "$PROJECT_ID"; then
    PROJECT="$PROJECT_ID"
  else
    PROJECT="$(create_project "$PROJECT_ID")"
    [[ -n "$PROJECT" ]] || { echo "error: プロジェクト $PROJECT_ID を作成できませんでした" >&2; exit 1; }
  fi
elif project_available "$PROJECT_BASE"; then
  PROJECT="$PROJECT_BASE"
else
  PROJECT="$(create_project "$PROJECT_BASE")"
  if [[ -z "$PROJECT" ]]; then
    warn "$PROJECT_BASE は使用済み(または作成権限なし)。ランダムサフィックスで再試行します。"
    for _ in 1 2 3 4 5; do
      candidate="${PROJECT_BASE}-$(printf '%04d' $((RANDOM % 10000)))"
      PROJECT="$(create_project "$candidate")"
      [[ -n "$PROJECT" ]] && break
    done
    [[ -n "$PROJECT" ]] || { echo "error: 代替プロジェクトも作成できませんでした" >&2; exit 1; }
  fi
fi
echo "project: $PROJECT"

# ---------------------------------------------------------------------------
log "請求先アカウントのリンク ($BILLING_ACCOUNT)"
gcloud billing projects link "$PROJECT" \
  --billing-account="$BILLING_ACCOUNT" \
  --quiet >/dev/null
gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)' | grep -qx True \
  || { echo "error: 請求先アカウントのリンクに失敗しました" >&2; exit 1; }

# ---------------------------------------------------------------------------
log "API の有効化"
gcloud services enable "${APIS[@]}" --project="$PROJECT" --quiet

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
echo "project number: $PROJECT_NUMBER"

# ---------------------------------------------------------------------------
log "Artifact Registry リポジトリ ($AR_REPOSITORY / $REGION)"
if gcloud artifacts repositories describe "$AR_REPOSITORY" \
    --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  echo "既存のリポジトリを使用します"
else
  gcloud artifacts repositories create "$AR_REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Volga Field container images" \
    --project="$PROJECT" >/dev/null
fi

# ---------------------------------------------------------------------------
log "サービスアカウント"
ensure_service_account() {
  local id="$1" display="$2" email
  email="${id}@${PROJECT}.iam.gserviceaccount.com"
  if gcloud iam service-accounts describe "$email" --project="$PROJECT" >/dev/null 2>&1; then
    echo "既存: $email" >&2
  else
    gcloud iam service-accounts create "$id" \
      --display-name="$display" --project="$PROJECT" >/dev/null
    echo "作成: $email" >&2
  fi
  echo "$email"
}

DEPLOYER_EMAIL="$(ensure_service_account "$DEPLOYER_SA_ID" "GitHub Actions deployer")"
RUNTIME_EMAIL="$(ensure_service_account "$RUNTIME_SA_ID" "Cloud Run runtime (no GCP API access)")"

log "github-deployer への最小権限付与"
DEPLOYER_ROLES=(
  roles/run.admin
  roles/iam.serviceAccountUser
  roles/artifactregistry.writer
  roles/cloudbuild.builds.editor
  roles/storage.objectAdmin
)
for role in "${DEPLOYER_ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${DEPLOYER_EMAIL}" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null
  echo "  $role"
done

# ランタイム SA にはロールを付与しない(実行時に GCP API を呼ばないため)。

# ---------------------------------------------------------------------------
log "Workload Identity Federation"
if gcloud iam workload-identity-pools describe "$POOL_ID" \
    --location=global --project="$PROJECT" >/dev/null 2>&1; then
  echo "既存プール: $POOL_ID"
else
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --location=global \
    --display-name="GitHub Actions" \
    --description="OIDC pool for ${GITHUB_REPOSITORY}" \
    --project="$PROJECT" >/dev/null
  echo "作成プール: $POOL_ID"
fi

PROVIDER_ARGS=(
  "$PROVIDER_ID"
  --location=global
  --workload-identity-pool="$POOL_ID"
  --display-name="GitHub OIDC"
  --issuer-uri="https://token.actions.githubusercontent.com"
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref"
  --attribute-condition="assertion.repository == \"${GITHUB_REPOSITORY}\""
  --project="$PROJECT"
)
if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
    --location=global --workload-identity-pool="$POOL_ID" --project="$PROJECT" >/dev/null 2>&1; then
  # 条件を常に最新化する(冪等)。
  gcloud iam workload-identity-pools providers update-oidc "${PROVIDER_ARGS[@]}" >/dev/null
  echo "更新プロバイダ: $PROVIDER_ID"
else
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ARGS[@]}" >/dev/null
  echo "作成プロバイダ: $PROVIDER_ID"
fi

PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPOSITORY}"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="$PRINCIPAL" \
  --project="$PROJECT" \
  --quiet >/dev/null

# ---------------------------------------------------------------------------
log "active project を $PROJECT に切り替え"
gcloud config set project "$PROJECT" >/dev/null

WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPOSITORY}/${SERVICE_NAME}"

cat <<EOF

================ セットアップ完了 ================
PROJECT_ID                 : ${PROJECT}
PROJECT_NUMBER             : ${PROJECT_NUMBER}
REGION                     : ${REGION}
ARTIFACT_REGISTRY          : ${AR_REPOSITORY} (${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPOSITORY})
SERVICE_NAME               : ${SERVICE_NAME}
IMAGE                      : ${IMAGE_BASE}
DEPLOYER_SERVICE_ACCOUNT   : ${DEPLOYER_EMAIL}
RUNTIME_SERVICE_ACCOUNT    : ${RUNTIME_EMAIL}
WIF_POOL                   : projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}
WIF_PROVIDER               : ${WIF_PROVIDER}
WIF_ATTRIBUTE_CONDITION    : assertion.repository == "${GITHUB_REPOSITORY}"
==================================================
EOF
