import { QdrantClient } from '@qdrant/js-client-rest';
import { Product } from '../types';

export interface ProductVector {
  id: string;
  vector: number[];
  payload: {
    product_id: string;
    name: string;
    brand: string;
    category: string[];
    price: number;
    color: string[];
    keywords: string[];
    description: string;
    created_at: string;
  };
}

export interface SearchResult {
  product_id: string;
  score: number;
  payload: ProductVector['payload'];
}

class QdrantVectorStore {
  private client: QdrantClient | null = null;
  private collectionName = 'products';
  private vectorSize = 1536; // OpenAI embedding size

  // Qdrantクライアントの初期化
  async initialize() {
    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
      throw new Error('Qdrant credentials not configured');
    }

    this.client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    // コレクションの存在確認
    try {
      await this.client.getCollection(this.collectionName);
      console.log(`✅ Qdrant collection '${this.collectionName}' exists`);
    } catch (error) {
      // コレクションが存在しない場合は作成
      console.log(`🔄 Creating Qdrant collection '${this.collectionName}'...`);
      await this.createCollection();
    }
  }

  // コレクション作成
  private async createCollection() {
    if (!this.client) throw new Error('Qdrant client not initialized');

    await this.client.createCollection(this.collectionName, {
      vectors: {
        size: this.vectorSize,
        distance: 'Cosine', // コサイン距離
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });

    // インデックス作成
    await this.client.createPayloadIndex(this.collectionName, {
      field_name: 'category',
      field_schema: 'keyword',
    });

    await this.client.createPayloadIndex(this.collectionName, {
      field_name: 'brand',
      field_schema: 'keyword',
    });

    await this.client.createPayloadIndex(this.collectionName, {
      field_name: 'price',
      field_schema: 'integer',
    });

    console.log(`✅ Qdrant collection '${this.collectionName}' created`);
  }

  // ベクトル保存
  async upsertVectors(vectors: ProductVector[]) {
    if (!this.client) {
      await this.initialize();
    }

    const points = vectors.map((vector, index) => ({
      id: vector.id,
      vector: vector.vector,
      payload: vector.payload,
    }));

    // バッチサイズで分割してアップロード
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      
      await this.client!.upsert(this.collectionName, {
        wait: true,
        points: batch,
      });

      console.log(`📤 Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(points.length / batchSize)}`);
    }

    console.log(`✅ Uploaded ${vectors.length} vectors to Qdrant`);
  }

  // ベクトル検索
  async searchSimilar(
    queryVector: number[],
    limit: number = 10,
    filters?: any
  ): Promise<SearchResult[]> {
    if (!this.client) {
      await this.initialize();
    }

    const searchRequest: any = {
      vector: queryVector,
      limit,
      with_payload: true,
    };

    // フィルター条件があれば追加
    if (filters) {
      searchRequest.filter = filters;
    }

    const results = await this.client!.search(this.collectionName, searchRequest);

    return results.map(result => ({
      product_id: result.payload?.product_id as string,
      score: result.score,
      payload: result.payload as ProductVector['payload'],
    }));
  }

  // フィルター付き検索
  async searchWithFilters(
    queryVector: number[],
    options: {
      limit?: number;
      minPrice?: number;
      maxPrice?: number;
      categories?: string[];
      brands?: string[];
      colors?: string[];
    } = {}
  ): Promise<SearchResult[]> {
    const filters: any = { must: [] };

    // 価格範囲フィルター
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      const priceFilter: any = { key: 'price' };
      if (options.minPrice !== undefined && options.maxPrice !== undefined) {
        priceFilter.range = { gte: options.minPrice, lte: options.maxPrice };
      } else if (options.minPrice !== undefined) {
        priceFilter.range = { gte: options.minPrice };
      } else if (options.maxPrice !== undefined) {
        priceFilter.range = { lte: options.maxPrice };
      }
      filters.must.push(priceFilter);
    }

    // カテゴリフィルター
    if (options.categories && options.categories.length > 0) {
      filters.must.push({
        key: 'category',
        match: { any: options.categories },
      });
    }

    // ブランドフィルター
    if (options.brands && options.brands.length > 0) {
      filters.must.push({
        key: 'brand',
        match: { any: options.brands },
      });
    }

    // カラーフィルター
    if (options.colors && options.colors.length > 0) {
      filters.must.push({
        key: 'color',
        match: { any: options.colors },
      });
    }

    return this.searchSimilar(
      queryVector,
      options.limit || 10,
      filters.must.length > 0 ? filters : undefined
    );
  }

  // コレクション統計情報取得
  async getCollectionInfo() {
    if (!this.client) {
      await this.initialize();
    }

    const info = await this.client!.getCollection(this.collectionName);
    return {
      vectorsCount: info.vectors_count,
      indexedVectorsCount: info.indexed_vectors_count,
      pointsCount: info.points_count,
      segmentsCount: info.segments_count,
      status: info.status,
    };
  }

  // 商品削除
  async deleteProduct(productId: string) {
    if (!this.client) {
      await this.initialize();
    }

    await this.client!.delete(this.collectionName, {
      wait: true,
      points: [productId],
    });
  }

  // コレクション削除（開発用）
  async deleteCollection() {
    if (!this.client) {
      await this.initialize();
    }

    await this.client!.deleteCollection(this.collectionName);
    console.log(`🗑️ Deleted collection '${this.collectionName}'`);
  }
}

export default QdrantVectorStore;