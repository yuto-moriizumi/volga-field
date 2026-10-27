# GCP Cloud Run へのサーバーデプロイ

`apps/server`(WebSocket サーバー)を Google Cloud Run で運用するためのドキュメント。
フロントエンド(`apps/web`)は Vercel のままで、ここでは扱わない。

## 構成

```
ブラウザ
  │  HTTPS (画面)
  ▼
Vercel  ─── apps/web (Next.js 15)
  │
  │  WSS (ゲームのやり取り / JSON メッセージ)
  ▼
Cloud Run  ── volga-field-server (apps/server, ws)
              asia-northeast1 / min-instances=0 / max-instances=1
```

- サーバーは HTTP エンドポイントを持たない(`/healthz` も無い)。通常の HTTP リクエストには
  `ws` 内蔵の HTTP サーバーが `426 Upgrade Required` を返す。Cloud Run の起動プローブは
  既定の TCP プローブなので、これでもヘルスチェックは通る。
- 状態はすべてプロセス内メモリ(DB なし)。だから `max-instances=1` 固定。

### 現在の本番リソース

| 項目 | 値 |
| --- | --- |
| GCP プロジェクト | `volga-field-prod` (number `886229712395`) |
| リージョン | `asia-northeast1` |
| Cloud Run サービス | `volga-field-server` |
| サービス URL | https://volga-field-server-sppcik5iea-an.a.run.app |
| WebSocket URL | `wss://volga-field-server-sppcik5iea-an.a.run.app` |
| Artifact Registry | `asia-northeast1-docker.pkg.dev/volga-field-prod/volga/volga-field-server` |
| デプロイ用 SA | `github-deployer@volga-field-prod.iam.gserviceaccount.com` |
| ランタイム SA | `volga-runtime@volga-field-prod.iam.gserviceaccount.com` |
| WIF プロバイダ | `projects/886229712395/locations/global/workloadIdentityPools/github/providers/github-oidc` |

## 初回セットアップ

前提: `gcloud` にログイン済みで、請求先アカウント `01266A-F4EA26-685168` を利用できること。

```bash
gcloud auth login
bash scripts/setup-gcp.sh
```

スクリプトは冪等(何度実行しても安全)で、以下をまとめて行う。

1. プロジェクト作成。`volga-field-prod` が使用済みなら `volga-field-prod-XXXX` を自動で選ぶ
   (`PROJECT_ID=...` を渡せば明示指定もできる)
2. 請求先アカウントのリンクと、必要 API の有効化
   (`run` / `artifactregistry` / `iam` / `iamcredentials` / `cloudresourcemanager` / `cloudbuild` / `storage`)
3. Artifact Registry の Docker リポジトリ `volga`(asia-northeast1)
4. サービスアカウント 2 つ
   - `github-deployer`: `roles/run.admin`, `roles/iam.serviceAccountUser`,
     `roles/artifactregistry.writer`, `roles/cloudbuild.builds.editor`, `roles/storage.objectAdmin`
   - `volga-runtime`: **ロールなし**(実行時に GCP API を呼ばないため)
5. Workload Identity Federation のプール `github` とプロバイダ `github-oidc`
   (issuer は `https://token.actions.githubusercontent.com`、
   `attribute.repository == "yuto-moriizumi/volga-field"` 以外を拒否する条件付き)

> 既存の他プロジェクト(`bottlist`, `discord-embedded-app`, `gen-lang-client-*`)には触れない。
> スクリプトは最後に `gcloud config set project <新プロジェクト>` だけ行う。

### ブートストラップ(最初の 1 回だけ)

ローカルに Docker が無くても、Cloud Build にビルドさせれば初回デプロイできる。

```bash
PROJECT_ID=volga-field-prod bash scripts/deploy-cloudrun.sh --source .
```

2 回目以降は GitHub Actions(下記)に任せる。手元に Docker があるなら
`--source` の代わりに `--image <Artifact Registry のイメージ>` でもよい。

## 自動デプロイの仕組み

`.github/workflows/deploy-server.yml` が `main` への push で動く。

- 対象パス: `apps/server/**`, `packages/**`, `Dockerfile`, `.dockerignore`,
  `scripts/deploy-cloudrun.sh`, ワークフロー自身。フロントだけの変更では走らない。
- `workflow_dispatch` で手動実行もできる(`gh workflow run deploy-server.yml`)。
- 認証は **GitHub OIDC → Workload Identity Federation のみ**。
  `google-github-actions/auth@v2` に `workload_identity_provider` と `service_account` を渡すだけで、
  **リポジトリシークレットは一切使わない**(長期キーを持たない)。
- イメージは GitHub ランナーの Docker でビルドし、`gcloud auth print-access-token` で
  Artifact Registry にログインして `docker buildx build --push` する。
  タグはコミット SHA(先頭 12 桁)と `latest` の 2 つ。
- デプロイは `scripts/deploy-cloudrun.sh --image ...` を呼ぶ。Cloud Run のフラグは
  このスクリプトに一元化してあり、ブートストラップ時と CI で完全に同じ値を使う:
  `--region asia-northeast1 --port 8080 --allow-unauthenticated --timeout 3600
  --min-instances 0 --max-instances 1 --concurrency 20 --cpu 1 --memory 512Mi
  --cpu-boost --service-account volga-runtime@volga-field-prod.iam.gserviceaccount.com`
- `concurrency:` で同時デプロイは直列化される。
- デプロイ後、サービス URL が GitHub Actions の Step Summary に出る。

### WIF の条件を変えたいとき

リポジトリ名を変える / fork を許可する場合は、プロバイダの attribute condition を更新する。

```bash
gcloud iam workload-identity-pools providers update-oidc github-oidc \
  --location=global --workload-identity-pool=github \
  --project=volga-field-prod \
  --attribute-condition='assertion.repository == "OWNER/REPO"'
```

プリンシパル(`attribute.repository/OWNER/REPO`)の `roles/iam.workloadIdentityUser` バインドも
あわせて貼り直す。`scripts/setup-gcp.sh` を再実行すれば条件の更新とバインドの追加は自動で行われる
(古いプリンシパルのバインドは残るので、必要なら手で外す)。

## 手動で必要な作業

### Vercel の `NEXT_PUBLIC_WS_URL`

フロントは WebSocket の接続先をビルド時に埋め込むため、**Vercel 側で環境変数を設定して再デプロイ**する必要がある。

```
NEXT_PUBLIC_WS_URL = wss://volga-field-server-sppcik5iea-an.a.run.app
```

- 既定値は `apps/web/src/lib/GameContext.tsx` の `ws://${host}:4000`。
  HTTPS で配信される Vercel 上では **混合コンテンツとしてブロックされ接続できない**。
- `NEXT_PUBLIC_*` はビルド時に埋め込まれるので、値を変えたら Vercel で再デプロイが必要。
- サービス URL を変えた場合(作り直し・別プロジェクト)は、ここも更新して再デプロイする。
- CORS は WebSocket では効かないため、Vercel 側の追加設定は不要。

## 既知の制約

- **WebSocket は最長 60 分で切れる。** Cloud Run のリクエストタイムアウトを 3600 秒にしているため、
  1 接続は 1 時間で打ち切られる。ロビーに戻って再接続する導線はまだ無い。
- **`max-instances=1` は必須。** ルームとゲーム状態はプロセス内メモリにしか無いので、
  複数インスタンスに分散すると同じルームのプレイヤーが別インスタンスに繋がって壊れる。
  スケールアウトさせるには Redis などで状態を外出しする必要がある。
- **`min-instances=0`。** アクセスが無いとインスタンスは 0 になり、次の接続はコールドスタート
  (数秒)になる。待たせたくない場合は `--min-instances 1` にするが、常時課金になる。
- **再デプロイで進行中の試合は消える。** 新リビジョンへの切り替えで接続が切れ、メモリ上の状態も失われる。
  デプロイは試合中を避けるのが無難。
- ターンタイマーと再接続トークンは未実装。切断するとそのプレイヤーは戻れない。

## 費用の目安

- Cloud Run はリクエスト課金 + CPU/メモリの従量課金。`min-instances=0` なので
  誰も遊んでいない時間帯はほぼ 0 円。
- 無料枠の目安(月あたり): 180,000 vCPU 秒、360,000 GiB 秒、200 万リクエスト。
  `--cpu 1 --memory 512Mi` の 1 インスタンスを 1 時間動かすと概算 3,600 vCPU 秒 / 1,800 GiB 秒。
  個人利用の範囲なら無料枠に収まりやすい。
- Artifact Registry は無料枠 0.5 GB。現状のイメージは約 60 MB(圧縮)なので、
  SHA タグが溜まると超えることがある。古いイメージは定期的に消す:

  ```bash
  gcloud artifacts docker images list \
    asia-northeast1-docker.pkg.dev/volga-field-prod/volga/volga-field-server \
    --include-tags --sort-by=~CREATE_TIME
  # 不要な SHA タグを削除
  gcloud artifacts docker images delete \
    asia-northeast1-docker.pkg.dev/volga-field-prod/volga/volga-field-server:<tag>
  ```

- Cloud Build(初回ブートストラップ時のみ)と Cloud Storage の微小な保存料もかかる。

## ロールバック

過去のリビジョンへトラフィックを戻す。

```bash
# リビジョン一覧(新しい順)
gcloud run revisions list --service volga-field-server \
  --region asia-northeast1 --project volga-field-prod

# 特定リビジョンへ 100% 戻す
gcloud run services update-traffic volga-field-server \
  --region asia-northeast1 --project volga-field-prod \
  --to-revisions volga-field-server-00001-lmc=100
```

コードを戻したい場合は `main` を revert して push すれば、CI が新しいリビジョンを作る。

## シークレットを使っていない理由

- デプロイに必要なのは GCP の認証だけ。OIDC + WIF なら GitHub が発行する短命トークンで認証でき、
  リポジトリに長期キー(JSON キー)を置く必要がない。漏洩リスクとローテーション作業を無くせる。
- アプリ自体も外部サービスの資格情報を使わない(状態はメモリのみ、DB も外部 API も無し)ため、
  Cloud Run に渡すシークレットが存在しない。将来 DB や外部 API を使う場合は
  Secret Manager + `--set-secrets` を追加し、ランタイム SA に `roles/secretmanager.secretAccessor` を付ける。
