import OpenAI from 'openai';
import { Product } from '../types';
import { ProductVector } from './QdrantClient';

class EmbeddingService {
  private openai: OpenAI | null = null;
  private model = 'text-embedding-3-small'; // コスト効率の良いモデル

  // OpenAI初期化
  async initialize() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('✅ OpenAI Embedding Service initialized');
  }

  // 商品データを検索可能なテキストに変換
  private createSearchText(product: Product): string {
    const searchTexts = [
      // 基本情報
      `商品名: ${product.name}`,
      `ブランド: ${product.brand}`,
      `カテゴリ: ${product.category.join(' ')}`,
      
      // 詳細情報
      `色: ${product.color.join(' ')}`,
      `素材: ${product.material}`,
      `価格: ${product.price}円`,
      
      // 説明・キーワード
      `説明: ${product.description}`,
      `キーワード: ${product.keywords.join(' ')}`,
      
      // ターゲット・シーン
      `対象: ${product.target}`,
      `シーン: ${product.scene}`,
      `おすすめ: ${product.recommend_for}`,
      
      // キャッチコピー
      `特徴: ${product.catchcopy}`,
      
      // 季節・新商品
      `季節: ${product.season}`,
      product.is_new ? '新商品' : '',
    ].filter(Boolean);

    return searchTexts.join('\n');
  }

  // 単一テキストのエンベディング生成
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      await this.initialize();
    }

    try {
      const response = await this.openai!.embeddings.create({
        model: this.model,
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      throw error;
    }
  }

  // 複数テキストのバッチエンベディング生成
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      await this.initialize();
    }

    // OpenAI APIの制限に合わせてバッチサイズを調整
    const batchSize = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        console.log(`🔄 Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
        
        const response = await this.openai!.embeddings.create({
          model: this.model,
          input: batch,
          encoding_format: 'float',
        });

        const batchEmbeddings = response.data.map(item => item.embedding);
        allEmbeddings.push(...batchEmbeddings);

        // レート制限対策（短い待機時間）
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Batch embedding failed for batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }
    }

    return allEmbeddings;
  }

  // 商品データからProductVectorを生成
  async generateProductVectors(products: Product[]): Promise<ProductVector[]> {
    console.log(`🔄 Generating embeddings for ${products.length} products...`);
    
    // 検索テキストを作成
    const searchTexts = products.map(product => this.createSearchText(product));
    
    // バッチでエンベディング生成
    const embeddings = await this.generateBatchEmbeddings(searchTexts);
    
    // ProductVectorオブジェクトを作成
    const productVectors: ProductVector[] = products.map((product, index) => ({
      id: product.id,
      vector: embeddings[index],
      payload: {
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        color: product.color,
        keywords: product.keywords,
        description: product.description,
        created_at: new Date().toISOString(),
      },
    }));

    console.log(`✅ Generated ${productVectors.length} product vectors`);
    return productVectors;
  }

  // クエリテキストのエンベディング生成（検索用）
  async generateQueryEmbedding(query: string): Promise<number[]> {
    // クエリを日本語の検索に適した形式に正規化
    const normalizedQuery = this.normalizeQuery(query);
    return this.generateEmbedding(normalizedQuery);
  }

  // クエリの正規化
  private normalizeQuery(query: string): string {
    // 基本的な正規化
    let normalized = query.toLowerCase().trim();
    
    // よくある検索パターンの拡張
    const expansions: { [key: string]: string } = {
      '黒': '黒 ブラック',
      '白': '白 ホワイト',
      '赤': '赤 レッド',
      '青': '青 ブルー',
      '緑': '緑 グリーン',
      'tシャツ': 'Tシャツ カットソー',
      'デニム': 'デニム ジーンズ',
      'スカート': 'スカート フレアスカート タイトスカート',
      'パンツ': 'パンツ トラウザー スラックス',
      'おしゃれ': 'おしゃれ スタイリッシュ トレンド',
      'カジュアル': 'カジュアル リラックス 普段着',
      'きれいめ': 'きれいめ エレガント 上品',
    };

    // パターンマッチングで拡張
    for (const [key, expansion] of Object.entries(expansions)) {
      if (normalized.includes(key)) {
        normalized = normalized.replace(key, expansion);
      }
    }

    return normalized;
  }

  // エンベディングの類似度計算（デバッグ用）
  calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }

  // 統計情報
  getModelInfo() {
    return {
      model: this.model,
      vectorSize: 1536, // text-embedding-3-small のベクトルサイズ
      costPer1M: 0.02, // USD per 1M tokens
    };
  }
}

export default EmbeddingService;