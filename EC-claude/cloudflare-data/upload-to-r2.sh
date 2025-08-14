#!/bin/bash

# Cloudflare R2アップロードスクリプト
# 使用前に以下を設定してください:
# 1. Cloudflare R2バケットを作成
# 2. R2 APIトークンを取得
# 3. wranglerをインストール: npm install -g wrangler

echo "🚀 Cloudflare R2への商品データアップロード開始..."

# wranglerでR2バケットにファイルをアップロード
# バケット名を適切な名前に変更してください
BUCKET_NAME="ec-site-products"

echo "📦 商品データファイルをアップロード中..."
find . -name "*.txt" -type f | while read file; do
    echo "アップロード中: $file"
    wrangler r2 object put "$BUCKET_NAME/$file" --file="$file"
done

echo "✅ アップロード完了!"
echo "次のステップ:"
echo "1. Cloudflareダッシュボードでバケットを確認"
echo "2. AutoRAGインスタンスを作成"
echo "3. データソースとしてR2バケットを指定"
