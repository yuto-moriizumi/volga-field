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

- HP20で開始
- 手札5枚、山札から自動補充
- ターン制: カードを出して「ターン終了」を宣言
- カテゴリ: 武器 / 盾 / 薬 / 魔法 / 特殊