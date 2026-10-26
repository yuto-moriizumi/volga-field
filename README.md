# Volga Field

ゴッドフィールド風のターン制カードバトルRPG。

## 構成

- `apps/web` - Next.js 15 (App Router) のフロントエンド
- `apps/server` - WebSocket 対戦サーバー (Node.js + ws)
- `packages/game-core` - 純粋なゲームロジック (カード/戦闘/デッキ)
- `packages/shared` - 共通型とプロトコル定義

## 開発

```bash
npm install
npm run build:shared
npm run build:core
npm run dev
```

- Web: http://localhost:3000
- Server: ws://localhost:4000

## 身内ネタの追加方法

`packages/game-core/src/cards.ts` の `BASE_CARDS` 配列にカードを追加するだけで
新しいカードを作成できる。各カードに `customTags: ['meme', ...]` を付けると
フィルタリングできる。

## ゲームルール

- HP20で開始。**HPに上限はなく**、回復によって20を超えることができる
- MP10で開始（MPは上限あり）
- 手札5枚、山札から自動補充
- デッキは全99枚のカードから30枚を選んで構成する
- ターン制: 1ターン中に複数のカードをプレイでき、好きなタイミングで「ターン終了」を宣言する
- カテゴリ: 武器 / 盾 / 薬 / 奇跡 / 特殊 / 取引 / 無属性 / 雑貨 / 政党
- 修行モード: 2〜9人でプレイ可能。終末の時は G.F.50 / G.F.75 / G.F.100 から選択できる（なしも可）

実装済みカードの定義は `packages/game-core/src/cards.ts` を正とする。
