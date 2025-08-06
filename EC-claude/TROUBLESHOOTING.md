# 🔧 トラブルシューティングガイド

## 🚨 よくあるエラーと対処法

### 1. 商品データ読み込みエラー
```
Failed to load resource: the server responded with a status of 404 (Not Found)
商品データの読み込みに失敗しました: SyntaxError: Unexpected token '<'
```

**原因**: 商品データが public/data/ に配置されていない
**対処法**:
```bash
mkdir -p public/data
cp data/products.json public/data/products.json
```

### 2. Gemini API エラー (500 Internal Server Error)
```
Gemini API Error: サーバーエラーが発生しました。
```

**原因**: APIキーが未設定、無効、または形式が正しくない
**対処法**:

1. **APIキーの確認**
   ```bash
   # .env.local ファイルを確認
   cat .env.local
   ```

2. **正しいAPIキー形式**
   - Gemini APIキーは通常39文字の英数字
   - 形式: `AIzaSy...` で始まる文字列
   - [Google AI Studio](https://makersuite.google.com/app/apikey) で新しいキーを生成

3. **環境変数の設定**
   ```bash
   # .env.local ファイルを編集
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

4. **開発サーバーの再起動**
   ```bash
   # 既存プロセスを停止
   pkill -f "next dev"
   
   # 再起動
   npm run dev
   ```

### 3. ポート使用中エラー
```
Port 3000 is in use by process
```

**対処法**:
```bash
# ポート3000を使用しているプロセスを確認
lsof -ti:3000

# プロセスを停止
kill -9 $(lsof -ti:3000)

# または異なるポートで起動
npm run dev -- -p 3001
```

### 4. TypeScript型エラー
```
Type 'Product[]' is not assignable to type 'never[]'
```

**対処法**:
```bash
# 型定義を再生成
rm -rf .next
npm run build
```

### 5. 画像表示エラー
```
Failed to load image: /images/products/xxx.jpg
```

**対処法**:
- 画像ファイルを `public/images/products/` に配置
- プレースホルダー画像が自動表示されるため、機能には影響なし

## 🔍 デバッグ方法

### 1. ブラウザコンソールでエラー確認
```javascript
// F12 でコンソールを開く
// Network タブでAPIリクエストを確認
// Console タブでJavaScriptエラーを確認
```

### 2. サーバーログ確認
```bash
# 開発サーバーのログを確認
npm run dev
# エラーの詳細がターミナルに表示されます
```

### 3. APIエンドポイント直接テスト
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userInput":"テスト","products":[]}'
```

## 🆘 サポート

上記で解決しない場合:
1. GitHub Issues で報告
2. エラーメッセージとブラウザコンソールのスクリーンショットを添付
3. 環境情報 (OS, Node.js バージョン) を記載