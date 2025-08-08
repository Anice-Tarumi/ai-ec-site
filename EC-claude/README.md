# AI Fashion Store

AI を活用したファッション EC サイト。自然言語で商品を検索し、AI が個人に最適化された商品推薦とコーディネート提案を行います。

## 🌟 主な機能

### 🔥 最新機能（v2.1）
- **⚡ Vercel AI SDK 統合**: 業界標準ツールで安定性・拡張性を大幅向上
- **🏗️ 統一 API 基盤**: 複数 AI プロバイダー（OpenAI, Anthropic, Google）への簡単切り替え
- **🛠️ 改良エラーハンドリング**: 詳細ログ・包括的エラー処理で開発効率向上
- **📈 スコアリング改善**: より精密な重み付けアルゴリズムで検索精度向上

### 🔥 主要機能（v2.0）
- **🔄 ストリーミング AI 応答**: リアルタイムで回答が表示される自然な対話体験
- **🔍 RAG 検索システム**: 関連度ベースの高精度商品検索
- **📊 スコアリング検索**: 商品の関連度を数値化して最適な順序で表示
- **🤖 改良 AI 判断**: より精密なコーディネート提案と商品分類

### AI 機能
- **自然言語商品検索**: 「赤い服」「オフィスカジュアル」など直感的な検索
- **高度な検索アルゴリズム**: 完全一致・部分一致・関連度を総合的に判定
- **インテリジェント商品分類**: メイン推薦/コーディネート提案/関連商品の 3 段階提案
- **ベクトル検索対応**: Transformers.js による意味的類似性検索（フォールバック対応）

### ユーザー体験
- **ストリーミング表示**: AIの回答が文字ごとに流れるタイピング効果
- **レスポンシブデザイン**: モバイル・デスクトップ完全対応
- **美しいアニメーション**: スムーズなフェードイン・スライドイン効果
- **チャット形式 UI**: 直感的で使いやすいインターフェース

### 商品データ
- **15 項目の詳細情報**: ブランド、素材、サイズ、キーワードなど
- **多軸検索対応**: カテゴリ、色、価格、ターゲット層など
- **スマート重み付け**: 新商品・人気商品の優先表示
- **関連度スコアリング**: より精密な商品マッチング

## 🚀 技術スタック

### コア技術
- **フレームワーク**: Next.js 15.4.5
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **デプロイ**: Vercel 対応

### AI・検索技術
- **AI フレームワーク**: Vercel AI SDK 5.0+ (統一API)
- **メイン AI**: Google Gemini 1.5 Flash（Vercel AI SDK経由）
- **AI プロバイダー**: Google Generative AI (@ai-sdk/google)
- **ベクトル検索**: Transformers.js（@xenova/transformers）
- **Embedding モデル**: multilingual-e5-small（多言語対応）
- **ストリーミング**: AI SDK TextStreamResponse
- **検索アルゴリズム**: 改良スコアベース関連度検索

### データ処理
- **ベクトル化**: ローカル実行（完全無料）
- **ストレージ**: JSON + LocalStorage
- **類似度計算**: コサイン類似度

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
# Google Gemini API Key (両方必要)
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
```

**注意**: Vercel AI SDK は `GOOGLE_GENERATIVE_AI_API_KEY` を使用するため、両方の環境変数が必要です。

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
│   ├── api/chat/          # AI API エンドポイント（ストリーミング対応）
│   ├── components/        # React コンポーネント
│   │   ├── ChatBox.tsx    # チャット入力・ストリーミング制御
│   │   ├── ProductList.tsx # 商品一覧表示
│   │   └── ...
│   ├── types/            # TypeScript 型定義
│   │   └── index.ts      # Product, AIResponse, StoreState など
│   └── utils/            # ユーティリティ関数
│       ├── store.ts      # Zustand 状態管理
│       ├── AIService.ts  # ストリーミング AI 通信
│       └── VectorSearch.ts # RAG ベクトル検索エンジン
├── public/
│   └── data/             # 商品データ（JSON）
└── docs/                 # ドキュメント
```

## 🔧 アーキテクチャ詳細

### ストリーミング AI フロー
1. **ユーザー入力** → ChatBox.tsx
2. **商品検索** → VectorSearch.ts（スコアリング）
3. **AI 推論** → API Route（Server-Sent Events）
4. **リアルタイム表示** → ページコンポーネント
5. **商品分類表示** → 各リストコンポーネント

### RAG 検索システム
1. **初期化**: 商品データをベクトル化（バックグラウンド）
2. **検索**: クエリをスコアベースで評価
3. **フォールバック**: ベクトル検索失敗時は改良文字列検索
4. **関連度順**: スコア降順で AI に最適な商品セットを提供

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

商品データは以下の形式で管理され、RAG 検索システムで最適化されています：

```json
{
  "id": "p001",
  "name": "シンプルコットンTシャツ",
  "brand": "Basic&Co",
  "category": ["トップス", "Tシャツ", "夏物"],     // スコア+8
  "price": 1980,
  "size": ["S", "M", "L", "XL"],
  "color": ["白", "黒", "ネイビー"],              // スコア+6
  "material": "コットン100%",                    // スコア+3
  "description": "毎日使えるベーシックなTシャツ",   // スコア+2
  "keywords": ["カジュアル", "無地", "ベーシック"], // スコア+5
  "target": "20〜40代の男女",                    // スコア+3
  "scene": "普段着、通勤、部屋着",                // スコア+3
  "recommend_for": "シンプル好き",
  "catchcopy": "着るたびに心地いい定番Tシャツ",
  "image": "/images/products/tshirt.jpg",
  "rating": 4.3,                               // 人気ソート用
  "reviews": 216,
  "is_new": true,                              // スコア+1
  "season": "夏"
}
```

### 🔍 スコアリング詳細

検索クエリに対する各フィールドの重み付け：

| フィールド | 完全一致スコア | 効果 |
|-----------|---------------|------|
| **name** | +10 | 商品名完全一致（最優先）|
| **category** | +8 | カテゴリ一致（重要）|
| **color** | +6 | 色指定一致 |
| **keywords** | +5 | スタイル・用途一致 |
| **brand** | +4 | ブランド一致 |
| **material** | +3 | 素材一致 |
| **target** | +3 | 対象層一致 |
| **scene** | +3 | 用途・シーン一致 |
| **description** | +2 | 説明文一致 |
| **is_new** | +1 | 新商品ボーナス |

**例**: 「赤いシャツ」検索
- 商品A: name一致(+10) + color一致(+6) + category一致(+8) = **24点**
- 商品B: color一致(+6) + keywords一致(+5) = **11点**

→ 商品A が優先表示

## 📈 更新履歴

### v2.1 (2025-01-08) - Vercel AI SDK 統合
- ✅ **Vercel AI SDK 5.0+ 統合**: 業界標準の AI フレームワークに移行
- ✅ **統一 API 基盤**: 複数 AI プロバイダー対応（OpenAI, Anthropic, Google など）
- ✅ **改良ストリーミング**: AI SDK の TextStreamResponse で安定性向上
- ✅ **エラーハンドリング強化**: 詳細ログ・包括的エラー処理・デバッグ支援
- ✅ **検索アルゴリズム改善**: より精密な重み付けスコアリングシステム
- ✅ **型安全性向上**: TypeScript サポート強化・開発体験改善
- ✅ **将来性確保**: AI SDK エコシステムでの長期サポート・拡張性

**技術的改善点:**
- `streamText()` による安定したストリーミング処理
- `google()` プロバイダーでの統一API
- 改良されたRAG検索ロジック（重み付けスコアリング）
- 包括的なエラーログ・デバッグ情報

### v2.0 (2025-01-08)
- ✅ **ストリーミング AI 応答**: リアルタイムタイピング効果
- ✅ **RAG 検索システム**: スコアベース商品検索
- ✅ **ベクトル検索基盤**: Transformers.js 統合
- ✅ **改良 AI プロンプト**: より精密な商品分類

### v1.0 (初期リリース)
- ✅ 基本的な自然言語検索
- ✅ 商品分類・推薦機能
- ✅ Google Gemini API 統合

## 🚧 今後の実装予定

### Phase 3: 視覚的機能
- **Figma MCP 統合**: 商品画像の動的生成・編集
- **バリエーション画像**: 色・背景の自動変更
- **UI 動的生成**: A/B テスト用デザイン自動作成

### Phase 4: 高度な AI 機能
- **ファッション知識ベース**: 専門用語・トレンド情報統合
- **パーソナライゼーション**: ユーザー履歴に基づく個人化
- **詳細ベクトル検索**: サーバーサイドベクトル検索最適化

### Phase 5: エンタープライズ機能
- **在庫連携**: リアルタイム在庫管理
- **購買分析**: 売上・トレンド分析
- **多言語対応**: 国際展開準備

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