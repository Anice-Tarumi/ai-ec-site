import { Product } from '../types';
import DatabaseClient, { ProductSearchOptions, SearchHistoryEntry } from './DatabaseClient';
import QdrantVectorStore, { SearchResult as QdrantSearchResult } from './QdrantClient';
import EmbeddingService from './EmbeddingService';

export interface RAGSearchOptions {
  query: string;
  limit?: number;
  useVectorSearch?: boolean;
  useHybridSearch?: boolean;
  filters?: {
    categories?: string[];
    brands?: string[];
    colors?: string[];
    minPrice?: number;
    maxPrice?: number;
    season?: string;
    isNew?: boolean;
  };
  vectorWeight?: number; // ハイブリッド検索でのベクトル検索の重み (0-1)
}

export interface RAGSearchResult {
  products: Product[];
  searchType: 'vector' | 'traditional' | 'hybrid';
  totalResults: number;
  searchTimeMs: number;
  vectorResults?: QdrantSearchResult[];
  relevanceScores?: { [productId: string]: number };
}

class RAGService {
  private dbClient: DatabaseClient;
  private qdrantClient: QdrantVectorStore;
  private embeddingService: EmbeddingService;
  private initialized = false;

  constructor() {
    this.dbClient = new DatabaseClient();
    this.qdrantClient = new QdrantVectorStore();
    this.embeddingService = new EmbeddingService();
  }

  // 初期化
  async initialize() {
    if (this.initialized) return;

    console.log('🔧 RAG Service initializing...');
    
    await Promise.all([
      this.dbClient.initialize(),
      this.qdrantClient.initialize(),
      this.embeddingService.initialize(),
    ]);

    this.initialized = true;
    console.log('✅ RAG Service initialized');
  }

  // メイン検索機能
  async search(options: RAGSearchOptions): Promise<RAGSearchResult> {
    await this.initialize();
    
    const startTime = Date.now();
    const { query, limit = 20, useVectorSearch = true, useHybridSearch = true } = options;

    let searchResult: RAGSearchResult;

    if (useHybridSearch) {
      // ハイブリッド検索（ベクトル + 従来検索）
      searchResult = await this.hybridSearch(options);
    } else if (useVectorSearch) {
      // ベクトル検索のみ
      searchResult = await this.vectorSearch(options);
    } else {
      // 従来検索のみ
      searchResult = await this.traditionalSearch(options);
    }

    const searchTimeMs = Date.now() - startTime;
    searchResult.searchTimeMs = searchTimeMs;

    // 検索履歴を保存
    await this.saveSearchHistory({
      query,
      searchType: searchResult.searchType,
      resultsCount: searchResult.products.length,
      searchTimeMs,
    });

    return searchResult;
  }

  // ベクトル検索
  private async vectorSearch(options: RAGSearchOptions): Promise<RAGSearchResult> {
    const { query, limit = 20, filters } = options;

    // クエリのエンベディング生成
    const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);

    // Qdrantでベクトル検索
    const vectorResults = await this.qdrantClient.searchWithFilters(queryEmbedding, {
      limit: limit * 2, // 後でフィルタリングするため多めに取得
      categories: filters?.categories,
      brands: filters?.brands,
      colors: filters?.colors,
      minPrice: filters?.minPrice,
      maxPrice: filters?.maxPrice,
    });

    // 商品データを取得
    const productIds = vectorResults.map(result => result.product_id);
    const products = await this.dbClient.getProductsByIds(productIds);

    // 追加フィルタリング
    const filteredProducts = this.applyAdditionalFilters(products, filters);

    // 関連度スコアを保持
    const relevanceScores: { [productId: string]: number } = {};
    vectorResults.forEach(result => {
      relevanceScores[result.product_id] = result.score;
    });

    return {
      products: filteredProducts.slice(0, limit),
      searchType: 'vector',
      totalResults: filteredProducts.length,
      searchTimeMs: 0, // 後で設定
      vectorResults,
      relevanceScores,
    };
  }

  // 従来検索
  private async traditionalSearch(options: RAGSearchOptions): Promise<RAGSearchResult> {
    const { query, limit = 20, filters } = options;

    const searchOptions: ProductSearchOptions = {
      limit: limit * 2,
      keywords: query,
      category: filters?.categories,
      brands: filters?.brands,
      colors: filters?.colors,
      minPrice: filters?.minPrice,
      maxPrice: filters?.maxPrice,
      season: filters?.season,
      isNew: filters?.isNew,
      sortBy: 'rating',
      sortOrder: 'desc',
    };

    const { products, total } = await this.dbClient.searchProducts(searchOptions);

    return {
      products: products.slice(0, limit),
      searchType: 'traditional',
      totalResults: total,
      searchTimeMs: 0, // 後で設定
    };
  }

  // ハイブリッド検索
  private async hybridSearch(options: RAGSearchOptions): Promise<RAGSearchResult> {
    const { vectorWeight = 0.7 } = options;
    const traditionalWeight = 1 - vectorWeight;

    // ベクトル検索と従来検索を並行実行
    const [vectorResult, traditionalResult] = await Promise.all([
      this.vectorSearch({ ...options, useHybridSearch: false }),
      this.traditionalSearch({ ...options, useHybridSearch: false }),
    ]);

    // 結果をマージしてスコアリング
    const combinedScores = new Map<string, number>();
    const allProducts = new Map<string, Product>();

    // ベクトル検索結果のスコア
    vectorResult.products.forEach((product, index) => {
      const vectorScore = vectorResult.relevanceScores?.[product.id] || 0;
      const positionScore = (vectorResult.products.length - index) / vectorResult.products.length;
      const finalScore = (vectorScore * 0.8 + positionScore * 0.2) * vectorWeight;
      
      combinedScores.set(product.id, finalScore);
      allProducts.set(product.id, product);
    });

    // 従来検索結果のスコア
    traditionalResult.products.forEach((product, index) => {
      const positionScore = (traditionalResult.products.length - index) / traditionalResult.products.length;
      const ratingScore = product.rating / 5.0;
      const finalScore = (positionScore * 0.7 + ratingScore * 0.3) * traditionalWeight;
      
      const existingScore = combinedScores.get(product.id) || 0;
      combinedScores.set(product.id, existingScore + finalScore);
      allProducts.set(product.id, product);
    });

    // スコア順でソート
    const sortedProducts = Array.from(combinedScores.entries())
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .map(([productId]) => allProducts.get(productId)!)
      .filter(Boolean)
      .slice(0, options.limit || 20);

    // 関連度スコアを統合
    const relevanceScores: { [productId: string]: number } = {};
    combinedScores.forEach((score, productId) => {
      relevanceScores[productId] = score;
    });

    return {
      products: sortedProducts,
      searchType: 'hybrid',
      totalResults: allProducts.size,
      searchTimeMs: 0, // 後で設定
      vectorResults: vectorResult.vectorResults,
      relevanceScores,
    };
  }

  // 追加フィルタリング
  private applyAdditionalFilters(products: Product[], filters?: RAGSearchOptions['filters']): Product[] {
    if (!filters) return products;

    return products.filter(product => {
      // 季節フィルター
      if (filters.season && product.season !== filters.season && product.season !== '通年') {
        return false;
      }

      // 新商品フィルター
      if (filters.isNew !== undefined && product.is_new !== filters.isNew) {
        return false;
      }

      return true;
    });
  }

  // 検索履歴保存
  private async saveSearchHistory(entry: SearchHistoryEntry) {
    try {
      await this.dbClient.saveSearchHistory(entry);
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }

  // 商品推薦（類似商品検索）
  async getRecommendations(productId: string, limit: number = 10): Promise<Product[]> {
    await this.initialize();

    // 基準商品を取得
    const baseProduct = await this.dbClient.getProductById(productId);
    if (!baseProduct) {
      throw new Error(`Product not found: ${productId}`);
    }

    // 商品情報をクエリとして使用
    const query = `${baseProduct.name} ${baseProduct.category.join(' ')} ${baseProduct.keywords.join(' ')}`;
    
    const result = await this.search({
      query,
      limit: limit + 1, // 自分自身を除外するため+1
      useHybridSearch: true,
      filters: {
        categories: [baseProduct.category[0]], // 同じメインカテゴリ
      },
    });

    // 自分自身を除外
    return result.products.filter(p => p.id !== productId).slice(0, limit);
  }

  // カテゴリ別人気商品
  async getPopularByCategory(category: string, limit: number = 20): Promise<Product[]> {
    await this.initialize();

    const { products } = await this.dbClient.searchProducts({
      category: [category],
      limit,
      sortBy: 'rating',
      sortOrder: 'desc',
    });

    return products;
  }

  // 統計情報取得
  async getSearchStats() {
    await this.initialize();
    
    const [dbStats, qdrantStats] = await Promise.all([
      this.dbClient.getProductStats(),
      this.qdrantClient.getCollectionInfo(),
    ]);

    return {
      database: dbStats,
      vectorStore: qdrantStats,
      embedding: this.embeddingService.getModelInfo(),
    };
  }

  // 接続終了
  async close() {
    await this.dbClient.close();
  }
}

export default RAGService;