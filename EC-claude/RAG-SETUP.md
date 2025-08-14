# RAG (Retrieval-Augmented Generation) セットアップガイド

このプロジェクトでは、Qdrant（ベクトルデータベース）とPostgreSQL（メタデータベース）を使用したRAGシステムを実装しています。

## 🏗️ アーキテクチャ

```
ユーザークエリ
    ↓
[エンベディング生成] ← OpenAI text-embedding-3-small
    ↓
[ベクトル検索] ← Qdrant Vector Database
    ↓
[メタデータ取得] ← PostgreSQL
    ↓
[ハイブリッド検索結果]
    ↓
[Gemini AI] ← RAG拡張プロンプト
    ↓
ストリーミングレスポンス
```

## 📋 前提条件

### 必要なサービス
1. **Qdrant Cloud** (無料プラン)
   - https://qdrant.tech/ でアカウント作成
   - クラスターを作成してURL/APIキーを取得

2. **PostgreSQL** (ローカルまたはクラウド)
   - ローカル: Docker使用
   - クラウド: Supabase、Neon、PlanetScale等

3. **OpenAI API** (エンベディング用)
   - https://platform.openai.com/api-keys
   - `text-embedding-3-small` モデル使用

4. **Google Gemini API** (既存)
   - 既に設定済み

## 🔧 セットアップ手順

### 1. 環境変数の設定

`.env.local` ファイルを作成し、以下を設定：

```bash
# 既存
GEMINI_API_KEY=your_gemini_api_key_here

# 新規追加
QDRANT_URL=https://your-cluster-url.qdrant.tech
QDRANT_API_KEY=your_qdrant_api_key
DATABASE_URL=postgresql://postgres:password@localhost:5432/ec_site
OPENAI_API_KEY=your_openai_api_key
```

### 2. データベースの準備

#### オプション A: Docker使用（推奨）
```bash
# PostgreSQLをDockerで起動
docker compose up -d postgres

# データベースの確認
docker compose logs postgres
```

#### オプション B: クラウドDB使用
- Supabase: https://supabase.com/
- Neon: https://neon.tech/
- PlanetScale: https://planetscale.com/

### 3. 商品データの生成

```bash
# 3000個の商品データを生成
node scripts/generate-products.js 3000

# 結果確認
ls -la public/data/products-large.json
```

### 4. RAGシステムのセットアップ

```bash
# RAGセットアップスクリプトを実行
node scripts/setup-rag.js
```

このスクリプトは以下を実行します：
1. PostgreSQLにテーブル作成と商品データ挿入
2. 商品データのエンベディング生成（OpenAI API使用）
3. Qdrantにベクトルデータアップロード
4. インデックス作成と統計情報表示

### 5. APIルートの切り替え

現在のAPIルート（`app/api/chat/route.ts`）をRAG版に変更：

```bash
# 現在のルートをバックアップ
mv app/api/chat/route.ts app/api/chat/route-original-backup.ts

# RAG版をメインに設定
mv app/api/chat/route-rag.ts app/api/chat/route.ts
```

### 6. アプリケーションの起動

```bash
npm run dev
```

## 🔍 RAG機能の特徴

### 検索方式
1. **ベクトル検索**: 意味的類似性による高精度検索
2. **従来検索**: キーワードマッチング
3. **ハイブリッド検索**: 両方を組み合わせ（デフォルト）

### フィルタリング機能
- 色指定（黒、白、赤等）
- カテゴリ（トップス、ボトムス等）
- 価格範囲
- ブランド
- 季節
- 新商品フラグ

### パフォーマンス最適化
- バッチ処理によるエンベディング生成
- インデックス最適化
- 検索結果キャッシュ
- ハイブリッドスコアリング

## 📊 使用量とコスト

### OpenAI API使用量
- 3000商品のエンベディング: 約$0.06
- 検索クエリ1回: 約$0.0001

### Qdrant Cloud（無料プラン）
- 1M ベクトル無料
- 3000商品は余裕で収容可能

### PostgreSQL
- ローカル: 無料
- クラウド: 各社の無料プランあり

## 🧪 テスト方法

### 基本検索テスト
```
「黒いTシャツを探しています」
「オフィス用のジャケット」
「3000円以下のスカート」
「新商品のワンピース」
```

### 意味的検索テスト
```
「大人っぽいコーディネート」
「カジュアルだけど上品」
「春らしい軽やかなスタイル」
```

## 🔧 トラブルシューティング

### よくある問題

#### 1. Qdrant接続エラー
```
Error: Qdrant credentials not configured
```
**解決**: `.env.local`のQDRANT_URLとQDRANT_API_KEYを確認

#### 2. PostgreSQL接続エラー
```
Error: DATABASE_URL not configured
```
**解決**: PostgreSQLが起動しているか確認、DATABASE_URLの形式確認

#### 3. OpenAI APIエラー
```
Error: OPENAI_API_KEY not configured
```
**解決**: OpenAI APIキーの設定確認、課金状況確認

#### 4. エンベディング生成エラー
```
Error: Rate limit exceeded
```
**解決**: OpenAI APIのレート制限、しばらく待ってから再実行

### デバッグコマンド

```bash
# PostgreSQL接続テスト
node -e "const { Pool } = require('pg'); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT NOW()').then(console.log).catch(console.error).finally(() => pool.end())"

# Qdrant接続テスト
node -e "const { QdrantClient } = require('@qdrant/js-client-rest'); const client = new QdrantClient({url: process.env.QDRANT_URL, apiKey: process.env.QDRANT_API_KEY}); client.getCollections().then(console.log).catch(console.error)"
```

## 📈 統計情報の確認

アプリケーション起動後、以下のAPIで統計情報を確認可能：

```bash
# 検索統計（開発用エンドポイント）
curl http://localhost:3000/api/rag-stats
```

## 🚀 本番環境への展開

### 環境変数の設定
Vercel等のホスティングサービスで以下の環境変数を設定：

```
GEMINI_API_KEY=production_key
QDRANT_URL=production_url
QDRANT_API_KEY=production_key
DATABASE_URL=production_db_url
OPENAI_API_KEY=production_key
```

### スケーリング考慮事項
- Qdrantクラスターのスケールアップ
- PostgreSQLのコネクションプール設定
- OpenAI APIのレート制限対策
- CDNによるレスポンス高速化

## 📚 追加リソース

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [PostgreSQL JSON Functions](https://www.postgresql.org/docs/current/functions-json.html)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)