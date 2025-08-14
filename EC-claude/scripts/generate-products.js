const fs = require('fs');
const path = require('path');

// 商品データ生成用の基本データ
const brands = [
  'Basic&Co', 'Natural Style', 'Flex Denim', 'Urban Chic', 'Classic Mode',
  'Trendy Look', 'Casual Life', 'Modern Fit', 'Style Plus', 'Fashion Forward',
  'Simple Line', 'Comfort Zone', 'Elegant Style', 'Smart Casual', 'Premium Basic',
  'Daily Wear', 'Weekend Style', 'Office Look', 'Street Fashion', 'Vintage Mode',
  'Eco Fashion', 'Luxe Basic', 'Active Wear', 'Minimalist', 'Contemporary',
  'Fresh Style', 'Urban Life', 'Classic Fit', 'Modern Basic', 'Style Essential'
];

const categories = [
  ['トップス', 'Tシャツ', '夏物'],
  ['トップス', 'シャツ', '春夏物'],
  ['ボトムス', 'デニム', '通年'],
  ['ボトムス', 'スカート', '春夏物'],
  ['ボトムス', 'パンツ', '通年'],
  ['アウター', 'ジャケット', '春秋物'],
  ['アウター', 'コート', '秋冬物'],
  ['ワンピース', 'カジュアル', '春夏物'],
  ['ワンピース', 'フォーマル', '通年'],
  ['アクセサリー', 'バッグ', '通年'],
  ['アクセサリー', 'シューズ', '通年'],
  ['アクセサリー', '帽子', '春夏物'],
  ['アクセサリー', 'ベルト', '通年'],
  ['インナー', '下着', '通年'],
  ['インナー', 'キャミソール', '春夏物'],
  ['スポーツ', 'トレーニングウェア', '通年'],
  ['スポーツ', 'スニーカー', '通年'],
  ['フォーマル', 'スーツ', '通年'],
  ['フォーマル', 'ドレス', '通年'],
  ['水着', 'ビキニ', '夏物']
];

const colors = [
  '白', '黒', 'ネイビー', 'グレー', 'ベージュ', 'ブラウン', '赤', '青', '緑', '黄',
  'ピンク', 'パープル', 'オレンジ', 'ライトブルー', 'ダークグレー', 'オフホワイト',
  'カーキ', 'マスタード', 'ボルドー', 'ターコイズ', 'ラベンダー', 'ミント',
  'コーラル', 'チャコール', 'アイボリー', 'ワイン', 'オリーブ', 'ロイヤルブルー'
];

const materials = [
  'コットン100%', 'ポリエステル100%', 'コットン80%・ポリエステル20%',
  'リネン70%・コットン30%', 'ウール100%', 'ナイロン100%', 'レーヨン100%',
  'コットン60%・ポリエステル40%', 'シルク100%', 'アクリル100%',
  'ポリウレタン5%・コットン95%', 'リネン100%', 'デニム（コットン100%）',
  'フリース（ポリエステル100%）', 'カシミヤ100%', 'レザー（牛革）',
  'フェイクレザー', 'ジャージー（コットン100%）', 'ストレッチデニム',
  'オーガニックコットン100%'
];

const sizes = [
  ['XS', 'S', 'M', 'L', 'XL'],
  ['S', 'M', 'L', 'XL'],
  ['S', 'M', 'L'],
  ['フリーサイズ'],
  ['22cm', '23cm', '24cm', '25cm', '26cm', '27cm'],
  ['38', '40', '42', '44', '46'],
  ['7号', '9号', '11号', '13号', '15号']
];

const keywords = [
  ['カジュアル', '無地', 'ベーシック', 'シンプル'],
  ['ナチュラル', '涼しい', '透け感', 'リネン'],
  ['ストレッチ', 'スキニー', 'デニム', 'カジュアル'],
  ['エレガント', 'フェミニン', '上品', 'きれいめ'],
  ['トレンド', 'モード', 'スタイリッシュ', 'おしゃれ'],
  ['コンフォート', '楽ちん', 'リラックス', '着心地'],
  ['フォーマル', 'ビジネス', 'きちんと', 'オフィス'],
  ['スポーティ', 'アクティブ', '動きやすい', '機能的'],
  ['ヴィンテージ', 'レトロ', 'クラシック', '古着風'],
  ['ミニマル', 'シンプル', '洗練', 'モダン']
];

const targets = [
  '20〜30代の女性', '30〜40代の女性', '40〜50代の女性',
  '20〜40代の男女', '30〜50代の男性', '20代の女性',
  '学生〜社会人', 'ビジネスパーソン', 'カジュアル派',
  'ナチュラル好き', 'トレンド好き', '大人女子'
];

const scenes = [
  'オフィス・通勤', 'デート・お出かけ', 'カジュアル・普段着',
  'パーティー・イベント', 'スポーツ・アクティブ', 'リゾート・旅行',
  'フォーマル・式典', '家・リラックス', 'ショッピング',
  '友人との集まり', '学校・通学', 'アウトドア'
];

const seasons = ['春', '夏', '秋', '冬', '春夏', '秋冬', '通年'];

const recommendFor = [
  'シンプル好き', 'ナチュラル派', 'トレンド好き', 'カジュアル派',
  'きれいめ好き', 'コンフォート重視', 'スタイリッシュ派',
  'エレガント好き', 'スポーティ派', 'ヴィンテージ好き'
];

// ランダム選択ヘルパー関数
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomChoices(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// 商品名生成
function generateProductName(category, material, color, brand) {
  const adjectives = [
    'シンプル', 'ベーシック', 'エレガント', 'カジュアル', 'モダン',
    'クラシック', 'スタイリッシュ', 'コンフォート', 'プレミアム',
    'ナチュラル', 'トレンド', 'ヴィンテージ', 'アーバン', 'ミニマル'
  ];
  
  const productTypes = {
    'Tシャツ': ['Tシャツ', 'カットソー', 'プルオーバー'],
    'シャツ': ['シャツ', 'ブラウス'],
    'デニム': ['デニムパンツ', 'ジーンズ'],
    'スカート': ['スカート', 'フレアスカート', 'タイトスカート'],
    'パンツ': ['パンツ', 'トラウザー', 'スラックス'],
    'ジャケット': ['ジャケット', 'ブレザー'],
    'コート': ['コート', 'トレンチコート', 'ダウンコート'],
    'ワンピース': ['ワンピース', 'ドレス'],
    'バッグ': ['バッグ', 'ハンドバッグ', 'ショルダーバッグ'],
    'シューズ': ['シューズ', 'パンプス', 'スニーカー', 'ブーツ']
  };
  
  const adj = randomChoice(adjectives);
  const material_short = material.split(/[%・]/)[0];
  const type = randomChoice(productTypes[category[1]] || [category[1]]);
  
  return `${adj}${material_short}${type}`;
}

// 商品説明生成
function generateDescription(category, material, keywords, target) {
  const descriptions = [
    `${keywords[0]}な${category[1]}。${material}で作られており、${keywords.slice(1).join('で')}な仕上がり。`,
    `${target}に人気の${category[1]}。${keywords.join('、')}をコンセプトにデザインされた一着。`,
    `毎日使える${keywords[0]}な${category[1]}。${material}の質感が特徴的で、長く愛用いただけます。`,
    `${keywords[0]}で${keywords[1]}な${category[1]}。様々なシーンで活躍する万能アイテム。`,
    `こだわりの${material}を使用した${category[1]}。${keywords.join('、')}な魅力を持つ逸品。`
  ];
  
  return randomChoice(descriptions);
}

// キャッチコピー生成
function generateCatchcopy(keywords, category) {
  const catchcopies = [
    `${keywords[0]}を極めた、究極の${category[1]}。`,
    `毎日着たくなる、${keywords[0]}な一着。`,
    `${keywords[0]}で${keywords[1]}。理想の${category[1]}がここに。`,
    `あなたの日常を彩る、${keywords[0]}な${category[1]}。`,
    `${keywords[0]}の魅力を最大限に引き出した逸品。`,
    `新しいスタイルの始まり。${keywords[0]}な${category[1]}。`,
    `心地よさと美しさを両立した${category[1]}。`,
    `${keywords[0]}を追求した、こだわりの一着。`
  ];
  
  return randomChoice(catchcopies);
}

// 商品データ生成
function generateProduct(id) {
  const brand = randomChoice(brands);
  const category = randomChoice(categories);
  const productColors = randomChoices(colors, randomInt(1, 4));
  const material = randomChoice(materials);
  const productSizes = randomChoice(sizes);
  const productKeywords = randomChoice(keywords);
  const target = randomChoice(targets);
  const scene = randomChoice(scenes);
  const season = randomChoice(seasons);
  const recommendForList = randomChoices(recommendFor, randomInt(1, 3));
  
  const name = generateProductName(category, material, productColors[0], brand);
  const description = generateDescription(category, material, productKeywords, target);
  const catchcopy = generateCatchcopy(productKeywords, category);
  
  const basePrice = randomInt(1000, 50000);
  const price = Math.round(basePrice / 100) * 100; // 100円単位に調整
  
  return {
    id: `p${String(id).padStart(4, '0')}`,
    name,
    brand,
    category,
    price,
    size: productSizes,
    color: productColors,
    material,
    description,
    keywords: productKeywords,
    target,
    scene,
    recommend_for: recommendForList.join(' / '),
    catchcopy,
    image: `/images/products/${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.jpg`,
    rating: randomFloat(3.0, 5.0),
    reviews: randomInt(0, 500),
    is_new: Math.random() < 0.1, // 10%の確率で新商品
    season
  };
}

// メイン処理
function generateProductData(count = 3000) {
  console.log(`${count}個の商品データを生成中...`);
  
  const products = [];
  for (let i = 1; i <= count; i++) {
    products.push(generateProduct(i));
    
    if (i % 500 === 0) {
      console.log(`${i}/${count} 完了`);
    }
  }
  
  // JSONファイルに保存
  const outputPath = path.join(__dirname, '..', 'public', 'data', 'products-large.json');
  fs.writeFileSync(outputPath, JSON.stringify(products, null, 2), 'utf8');
  
  console.log(`✅ ${count}個の商品データを生成完了！`);
  console.log(`📁 保存先: ${outputPath}`);
  console.log(`📊 ファイルサイズ: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)}MB`);
  
  // 統計情報
  const stats = {
    totalProducts: products.length,
    brands: [...new Set(products.map(p => p.brand))].length,
    categories: [...new Set(products.map(p => p.category[0]))].length,
    avgPrice: Math.round(products.reduce((sum, p) => sum + p.price, 0) / products.length),
    priceRange: {
      min: Math.min(...products.map(p => p.price)),
      max: Math.max(...products.map(p => p.price))
    },
    newProducts: products.filter(p => p.is_new).length
  };
  
  console.log('\n📈 統計情報:');
  console.log(`  商品数: ${stats.totalProducts}`);
  console.log(`  ブランド数: ${stats.brands}`);
  console.log(`  カテゴリ数: ${stats.categories}`);
  console.log(`  平均価格: ¥${stats.avgPrice.toLocaleString()}`);
  console.log(`  価格範囲: ¥${stats.priceRange.min.toLocaleString()} - ¥${stats.priceRange.max.toLocaleString()}`);
  console.log(`  新商品数: ${stats.newProducts}`);
  
  return products;
}

// コマンドライン引数から商品数を取得（デフォルト3000）
const productCount = process.argv[2] ? parseInt(process.argv[2]) : 3000;
generateProductData(productCount);