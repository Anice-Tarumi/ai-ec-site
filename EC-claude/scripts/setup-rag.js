const fs = require('fs');
const path = require('path');

// 環境変数の読み込み
require('dotenv').config({ path: '.env.local' });

// 動的インポートを使用してESモジュールを読み込み
async function setupRAG() {
  console.log('🚀 RAG セットアップを開始します...');
  
  // 環境変数チェック
  const requiredEnvVars = ['OPENAI_API_KEY', 'QDRANT_URL', 'QDRANT_API_KEY', 'DATABASE_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 以下の環境変数が設定されていません:');
    missingVars.forEach(varName => console.error(`   ${varName}`));
    console.error('\n.env.localファイルを確認してください。');
    process.exit(1);
  }

  try {
    // ESモジュールを動的にインポート
    const { default: DatabaseClient } = await import('../app/utils/DatabaseClient.js');
    const { default: QdrantVectorStore } = await import('../app/utils/QdrantClient.js');
    const { default: EmbeddingService } = await import('../app/utils/EmbeddingService.js');

    // 商品データの読み込み
    console.log('📖 商品データを読み込み中...');
    const productsPath = path.join(__dirname, '..', 'public', 'data', 'products-large.json');
    
    if (!fs.existsSync(productsPath)) {
      console.error('❌ 商品データファイルが見つかりません:', productsPath);
      console.log('先に商品データを生成してください: node scripts/generate-products.js');
      process.exit(1);
    }

    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    console.log(`✅ ${products.length}個の商品データを読み込みました`);

    // サービスの初期化
    console.log('\n🔧 サービスを初期化中...');
    const dbClient = new DatabaseClient();
    const qdrantClient = new QdrantVectorStore();
    const embeddingService = new EmbeddingService();

    await dbClient.initialize();
    await qdrantClient.initialize();
    await embeddingService.initialize();

    // PostgreSQLに商品データを保存
    console.log('\n📦 PostgreSQLに商品データを保存中...');
    const startTime = Date.now();
    await dbClient.insertProducts(products);
    const dbInsertTime = Date.now() - startTime;
    console.log(`✅ PostgreSQL保存完了 (${dbInsertTime}ms)`);

    // エンベディング生成とQdrantに保存
    console.log('\n🤖 エンベディングを生成中...');
    const embeddingStartTime = Date.now();
    
    // 商品を小さなバッチに分割して処理（メモリ効率のため）
    const batchSize = 500;
    let totalVectors = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(products.length / batchSize);
      
      console.log(`\n📊 バッチ ${batchNum}/${totalBatches} を処理中... (${batch.length}商品)`);
      
      // エンベディング生成
      const productVectors = await embeddingService.generateProductVectors(batch);
      
      // Qdrantに保存
      await qdrantClient.upsertVectors(productVectors);
      
      totalVectors += productVectors.length;
      console.log(`✅ バッチ ${batchNum} 完了 (累計: ${totalVectors}/${products.length})`);
      
      // メモリクリア
      if (global.gc) {
        global.gc();
      }
    }

    const embeddingTime = Date.now() - embeddingStartTime;
    console.log(`\n✅ 全エンベディング処理完了 (${Math.round(embeddingTime / 1000)}秒)`);

    // 統計情報の表示
    console.log('\n📊 セットアップ結果:');
    
    // PostgreSQL統計
    const dbStats = await dbClient.getProductStats();
    console.log('\nPostgreSQL:');
    console.log(`  商品数: ${dbStats.total_products}`);
    console.log(`  ブランド数: ${dbStats.total_brands}`);
    console.log(`  カテゴリ数: ${dbStats.total_categories}`);
    console.log(`  平均価格: ¥${dbStats.avg_price?.toLocaleString()}`);
    console.log(`  新商品数: ${dbStats.new_products}`);

    // Qdrant統計
    const qdrantStats = await qdrantClient.getCollectionInfo();
    console.log('\nQdrant:');
    console.log(`  ベクトル数: ${qdrantStats.pointsCount}`);
    console.log(`  インデックス済み: ${qdrantStats.indexedVectorsCount}`);
    console.log(`  ステータス: ${qdrantStats.status}`);

    // エンベディングサービス情報
    const embeddingInfo = embeddingService.getModelInfo();
    console.log('\nEmbedding Service:');
    console.log(`  モデル: ${embeddingInfo.model}`);
    console.log(`  ベクトルサイズ: ${embeddingInfo.vectorSize}`);
    console.log(`  推定コスト: $${(products.length * embeddingInfo.costPer1M / 1000000).toFixed(4)}`);

    // 処理時間サマリー
    console.log('\n⏱️  処理時間:');
    console.log(`  PostgreSQL: ${Math.round(dbInsertTime / 1000)}秒`);
    console.log(`  エンベディング + Qdrant: ${Math.round(embeddingTime / 1000)}秒`);
    console.log(`  合計: ${Math.round((Date.now() - startTime) / 1000)}秒`);

    // 接続を閉じる
    await dbClient.close();

    console.log('\n🎉 RAGセットアップが完了しました！');
    console.log('\n次のステップ:');
    console.log('1. APIルートを更新してRAG検索を使用する');
    console.log('2. フロントエンドでテストする');
    console.log('3. 検索性能を確認する');

  } catch (error) {
    console.error('\n❌ セットアップ中にエラーが発生しました:', error);
    console.error('\nエラー詳細:', error.stack);
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  setupRAG().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { setupRAG };