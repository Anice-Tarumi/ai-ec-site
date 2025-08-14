@echo off
echo 🚀 Cloudflare R2への商品データアップロード開始...

REM バケット名を適切な名前に変更してください
set BUCKET_NAME=ec-site-products

echo 📦 商品データファイルをアップロード中...
for %%f in (*.txt) do (
    echo アップロード中: %%f
    wrangler r2 object put "%BUCKET_NAME%/%%f" --file="%%f"
)

echo ✅ アップロード完了!
echo 次のステップ:
echo 1. Cloudflareダッシュボードでバケットを確認
echo 2. AutoRAGインスタンスを作成
echo 3. データソースとしてR2バケットを指定
pause
