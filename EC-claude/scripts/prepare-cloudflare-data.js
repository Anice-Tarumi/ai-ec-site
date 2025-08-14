const fs = require('fs');
const path = require('path');

// 商品データをCloudflare AutoRAG用に準備
function prepareDataForCloudflare() {
  console.log('📋 Cloudflare AutoRAG用データ準備開始...');

  // 商品データの読み込み
  const productsPath = path.join(__dirname, '..', 'public', 'data', 'products-large.json');
  
  if (!fs.existsSync(productsPath)) {
    console.error('❌ 商品データファイルが見つかりません:', productsPath);
    console.log('先に商品データを生成してください: node scripts/generate-products.js');
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  console.log(`📦 ${products.length}個の商品データを読み込みました`);

  // 出力ディレクトリの作成
  const outputDir = path.join(__dirname, '..', 'cloudflare-data');
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  // 各商品を個別ファイルとして保存
  products.forEach((product, index) => {
    const productText = createProductText(product);
    const fileName = `product-${product.id}.txt`;
    const filePath = path.join(outputDir, fileName);
    
    fs.writeFileSync(filePath, productText, 'utf8');
    
    if ((index + 1) % 500 === 0) {
      console.log(`📝 ${index + 1}/${products.length} ファイル作成完了`);
    }
  });

  // カテゴリ別サマリーファイルも作成
  createCategorySummaries(products, outputDir);

  // Cloudflare R2アップロード用のスクリプトも生成
  createUploadScript(outputDir);

  console.log(`✅ Cloudflare AutoRAG用データ準備完了!`);
  console.log(`📁 出力先: ${outputDir}`);
  console.log(`📊 生成ファイル数: ${products.length + getCategoryCount(products)}`);
  console.log('\n次のステップ:');
  console.log('1. CloudflareダッシュボードでR2バケット作成');
  console.log('2. 生成されたファイルをR2にアップロード');
  console.log('3. AutoRAGインスタンス作成');
}

// 商品情報を検索しやすいテキスト形式に変換
function createProductText(product) {
  return `商品ID: ${product.id}
商品名: ${product.name}
ブランド: ${product.brand}
カテゴリ: ${product.category.join(' / ')}
価格: ${product.price.toLocaleString()}円
サイズ: ${product.size.join(', ')}
カラー: ${product.color.join(', ')}
素材: ${product.material}
対象: ${product.target}
使用シーン: ${product.scene}
おすすめ: ${product.recommend_for}
季節: ${product.season}
新商品: ${product.is_new ? 'はい' : 'いいえ'}
評価: ${product.rating}/5.0 (${product.reviews}件のレビュー)

商品説明:
${product.description}

キャッチコピー:
${product.catchcopy}

キーワード: ${product.keywords.join(', ')}

この商品は${product.target}に人気で、${product.scene}に最適です。${product.keywords.join('、')}な特徴があり、${product.color.join('や')}などのカラーバリエーションがあります。${product.material}素材を使用しており、価格は${product.price.toLocaleString()}円です。`;
}

// カテゴリ別サマリーファイルの作成
function createCategorySummaries(products, outputDir) {
  const categoryMap = new Map();
  
  products.forEach(product => {
    const mainCategory = product.category[0];
    if (!categoryMap.has(mainCategory)) {
      categoryMap.set(mainCategory, []);
    }
    categoryMap.get(mainCategory).push(product);
  });

  categoryMap.forEach((categoryProducts, category) => {
    const summaryText = createCategorySummary(category, categoryProducts);
    const fileName = `category-${category.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    const filePath = path.join(outputDir, fileName);
    
    fs.writeFileSync(filePath, summaryText, 'utf8');
  });
}

// カテゴリサマリーテキストの生成
function createCategorySummary(category, products) {
  const brands = [...new Set(products.map(p => p.brand))];
  const colors = [...new Set(products.flatMap(p => p.color))];
  const priceRange = {
    min: Math.min(...products.map(p => p.price)),
    max: Math.max(...products.map(p => p.price)),
    avg: Math.round(products.reduce((sum, p) => sum + p.price, 0) / products.length)
  };
  
  const popularProducts = products
    .sort((a, b) => b.rating * Math.log(b.reviews + 1) - a.rating * Math.log(a.reviews + 1))
    .slice(0, 10);

  return `${category}カテゴリー概要

商品数: ${products.length}件
取り扱いブランド: ${brands.length}ブランド (${brands.slice(0, 5).join(', ')}${brands.length > 5 ? ' など' : ''})
カラーバリエーション: ${colors.slice(0, 10).join(', ')}${colors.length > 10 ? ' など' : ''}
価格帯: ${priceRange.min.toLocaleString()}円〜${priceRange.max.toLocaleString()}円 (平均: ${priceRange.avg.toLocaleString()}円)

${category}の特徴:
- 多様なスタイルとデザイン
- 幅広い価格帯で様々なニーズに対応
- 人気ブランドから新進ブランドまで豊富な選択肢

人気商品TOP10:
${popularProducts.map((p, i) => `${i + 1}. ${p.name} (${p.brand}) - ${p.price.toLocaleString()}円`).join('\n')}

${category}をお探しの方へ:
このカテゴリーでは${brands.length}の厳選されたブランドから${products.length}点の商品をご用意しています。${colors.slice(0, 3).join('、')}などの人気カラーを中心に、価格帯も${priceRange.min.toLocaleString()}円からとお手頃なものから高級品まで幅広く取り揃えています。

トレンドアイテムから定番商品まで、あなたのスタイルに合う${category}がきっと見つかります。`;
}

// カテゴリ数を取得
function getCategoryCount(products) {
  return new Set(products.map(p => p.category[0])).size;
}

// Cloudflare R2アップロード用スクリプトの生成
function createUploadScript(outputDir) {
  const uploadScript = `#!/bin/bash

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
`;

  const scriptPath = path.join(outputDir, 'upload-to-r2.sh');
  fs.writeFileSync(scriptPath, uploadScript, 'utf8');
  
  // Windows用バッチファイルも作成
  const batchScript = `@echo off
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
`;

  const batchPath = path.join(outputDir, 'upload-to-r2.bat');
  fs.writeFileSync(batchPath, batchScript, 'utf8');

  console.log('📜 アップロードスクリプトを生成しました:');
  console.log(`  Linux/Mac: ${scriptPath}`);
  console.log(`  Windows: ${batchPath}`);
}

// メイン実行
if (require.main === module) {
  prepareDataForCloudflare();
}

module.exports = { prepareDataForCloudflare };