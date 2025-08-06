# 🚀 AI連動型ECサイト - 起動ガイド

## クイックスタート

1. **依存関係のインストール**
   ```bash
   npm install
   ```
   
   > **注意**: npm cache エラーが発生する場合は、以下を実行してください:
   ```bash
   sudo chown -R $(whoami) ~/.npm
   npm cache clean --force
   npm install
   ```

2. **開発サーバーの起動**
   ```bash
   npm run dev
   ```

3. **ブラウザでアクセス**
   ```
   http://localhost:3000
   ```

## 🎯 使用方法

### 基本的な流れ
1. サイト下部のチャットボックスに希望を入力
2. AIが商品を分析して提案
3. 選ばれた商品が動的に表示

### 入力例
- **色で探す**: 「赤い服が欲しいです」
- **用途で探す**: 「ビジネス用の服を探しています」  
- **季節で探す**: 「夏の軽い服装」
- **スタイルで探す**: 「カジュアルな服」

## 🔧 トラブルシューティング

### よくある問題

#### 1. npm install でエラーが出る
```bash
# npm cache をクリア
sudo chown -R $(whoami) ~/.npm
npm cache clean --force
npm install
```

#### 2. 商品画像が表示されない
- `public/images/products/README.md` を確認
- プレースホルダー画像が自動表示されます

#### 3. AIが応答しない
- ブラウザの開発者ツールでエラーを確認
- 開発サーバーが正常に起動しているか確認

## 🌟 機能概要

### ✅ 実装済み機能
- [x] チャットインターフェース
- [x] AI商品提案（Gemini API実装）
- [x] AI要約機能
- [x] プロンプトインジェクション対策
- [x] 動的UI変更
- [x] リッチアニメーション
- [x] レスポンシブデザイン
- [x] 商品データ管理
- [x] 状態管理（Zustand）
- [x] TypeScript完全対応
- [x] Next.js 15 App Router

### 🔮 拡張可能な機能
- [ ] ユーザーアカウント
- [ ] ショッピングカート
- [ ] 決済システム
- [ ] 商品レビュー
- [ ] 在庫管理

## 📁 プロジェクト構造

```
EC-claude/
├── pages/              # Next.jsページ
├── components/         # Reactコンポーネント  
├── state/             # 状態管理
├── utils/             # ヘルパー関数
├── data/              # 商品データ
├── public/images/     # 商品画像
└── styles/            # スタイリング
```

## 🎨 カスタマイズ

### 商品データの変更
`data/products.json` を編集して商品を追加・変更できます。

### デザインの変更  
Tailwind CSSクラスを編集してUIをカスタマイズできます。

### AI応答の調整
`pages/api/chat.js` のモック実装を変更できます。

---

**楽しいECサイト開発を！** 🛍️✨