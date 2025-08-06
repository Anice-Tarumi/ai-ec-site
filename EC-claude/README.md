# AI Fashion Store

AI を活用したファッション EC サイト。自然言語で商品を検索し、AI が個人に最適化された商品推薦とコーディネート提案を行います。

## 🌟 主な機能

### AI 機能
- **自然言語商品検索**: 「赤い服」「オフィスカジュアル」など直感的な検索
- **インテリジェント商品分類**: メイン推薦/コーディネート提案/関連商品の 3 段階提案
- **リアルタイム AI 応答**: Google Gemini API による高精度な推薦

### ユーザー体験
- **レスポンシブデザイン**: モバイル・デスクトップ完全対応
- **美しいアニメーション**: スムーズなフェードイン・スライドイン効果
- **チャット形式 UI**: 直感的で使いやすいインターフェース

### 商品データ
- **15 項目の詳細情報**: ブランド、素材、サイズ、キーワードなど
- **多軸検索対応**: カテゴリ、色、価格、ターゲット層など
- **パーソナライゼーション**: 用途・シーンに応じた推薦

## 🚀 技術スタック

- **フレームワーク**: Next.js 15.4.5
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **AI**: Google Gemini API
- **デプロイ**: Vercel 対応

## 📦 セットアップ

### 必要な環境
- Node.js 18.0.0 以上
- npm または yarn

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd ai-fashion-store

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env.local
# .env.local に Gemini API キーを設定

# 開発サーバーを起動
npm run dev
```

### 環境変数設定

`.env.local` ファイルを作成し、以下を設定：

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Gemini API キーの取得方法は [Google AI Studio](https://makersuite.google.com/app/apikey) を参照してください。

## 🎯 使用方法

1. **商品検索**: 下部のチャット欄に自然言語で検索（例：「赤いシャツ」「デート用の服」）
2. **AI 推薦**: 以下 3 つのカテゴリで商品が表示されます：
   - **おすすめ商品**: 要望に最も適合する商品
   - **コーディネート提案**: 組み合わせ可能な商品
   - **関連商品**: 似たスタイルや代替案

## 🏗️ プロジェクト構造

```
├── app/
│   ├── api/chat/          # AI API エンドポイント
│   ├── components/        # React コンポーネント
│   ├── types/            # TypeScript 型定義
│   └── utils/            # ユーティリティ関数
├── public/
│   └── data/             # 商品データ（JSON）
└── docs/                 # ドキュメント
```

## 🔧 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# プロダクションサーバー起動
npm run start

# Linter 実行
npm run lint
```

## 📊 商品データ形式

商品データは以下の形式で管理されています：

```json
{
  "id": "p001",
  "name": "シンプルコットンTシャツ",
  "brand": "Basic&Co",
  "category": ["トップス", "Tシャツ", "夏物"],
  "price": 1980,
  "size": ["S", "M", "L", "XL"],
  "color": ["白", "黒", "ネイビー"],
  "material": "コットン100%",
  "description": "毎日使えるベーシックなTシャツ",
  "keywords": ["カジュアル", "無地", "ベーシック"],
  "target": "20〜40代の男女",
  "scene": "普段着、通勤、部屋着",
  "recommend_for": "シンプル好き",
  "catchcopy": "着るたびに心地いい定番Tシャツ",
  "image": "/images/products/tshirt.jpg",
  "rating": 4.3,
  "reviews": 216,
  "is_new": true,
  "season": "夏"
}
```

## 🤝 貢献

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 🙋‍♂️ サポート

質問や問題がある場合は、Issues ページで報告してください。

---

**AI Fashion Store** - 未来のファッション EC 体験を、今すぐ。