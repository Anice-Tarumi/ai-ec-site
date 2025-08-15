import { ChromaClient } from "chromadb";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface VectorSearchResult {
  id: string;
  distance: number;
  metadata: {
    name: string;
    brand: string;
    price: number;
  };
  document: string;
}

export interface SearchOptions {
  nResults?: number;
  includeMetadata?: boolean;
  includeDocuments?: boolean;
}

class ChromaService {
  private chromaClient: ChromaClient | null = null;
  private genAI: GoogleGenerativeAI | null = null;
  private collection: any = null;

  // ChromaDB接続初期化
  async initialize() {
    if (!this.chromaClient) {
      this.chromaClient = new ChromaClient({ 
        path: "http://localhost:8000" 
      });
      
      // productsコレクションを取得
      try {
        this.collection = await this.chromaClient.getCollection({ 
          name: "products" 
        });
        console.log('✅ ChromaDB connected successfully');
      } catch (error) {
        console.error('❌ ChromaDB collection not found:', error);
        throw new Error('ChromaDB products collection not found');
      }
    }

    if (!this.genAI) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
      }
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  // ユーザークエリをEmbedding化
  async embedQuery(query: string): Promise<number[]> {
    await this.initialize();

    if (!this.genAI) {
      throw new Error('Gemini AI not initialized');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: "embedding-001" });
      const embeddingResult = await model.embedContent(query);
      return embeddingResult.embedding.values;
    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      throw error;
    }
  }

  // ベクトル検索実行
  async searchSimilar(
    queryEmbedding: number[], 
    options: SearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    await this.initialize();

    if (!this.collection) {
      throw new Error('ChromaDB collection not initialized');
    }

    const {
      nResults = 10,
      includeMetadata = true,
      includeDocuments = true
    } = options;

    try {
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
        include: [
          'distances',
          ...(includeMetadata ? ['metadatas'] : []),
          ...(includeDocuments ? ['documents'] : [])
        ]
      });

      // 結果をフォーマット
      const formattedResults: VectorSearchResult[] = [];
      
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          formattedResults.push({
            id: results.ids[0][i],
            distance: results.distances ? results.distances[0][i] : 0,
            metadata: results.metadatas ? results.metadatas[0][i] : {},
            document: results.documents ? results.documents[0][i] : ''
          });
        }
      }

      return formattedResults;
    } catch (error) {
      console.error('❌ Vector search failed:', error);
      throw error;
    }
  }

  // ワンステップ検索（クエリ→Embedding→検索）
  async searchByQuery(
    query: string, 
    options: SearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    console.log('🔍 Vector search starting for:', query);
    
    const startTime = Date.now();
    
    try {
      // 1. クエリをEmbedding化
      const queryEmbedding = await this.embedQuery(query);
      console.log('✅ Query embedded successfully');

      // 2. ベクトル検索実行
      const results = await this.searchSimilar(queryEmbedding, options);
      
      const endTime = Date.now();
      console.log(`✅ Vector search completed in ${endTime - startTime}ms, found ${results.length} results`);

      return results;
    } catch (error) {
      console.error('❌ Vector search failed:', error);
      throw error;
    }
  }

  // コレクション統計取得
  async getCollectionStats() {
    await this.initialize();

    if (!this.collection) {
      throw new Error('ChromaDB collection not initialized');
    }

    try {
      const count = await this.collection.count();
      return {
        totalVectors: count,
        collectionName: 'products'
      };
    } catch (error) {
      console.error('❌ Failed to get collection stats:', error);
      throw error;
    }
  }

  // 接続テスト
  async testConnection(): Promise<boolean> {
    try {
      await this.initialize();
      const stats = await this.getCollectionStats();
      console.log('✅ ChromaDB connection test passed:', stats);
      return true;
    } catch (error) {
      console.error('❌ ChromaDB connection test failed:', error);
      return false;
    }
  }
}

export default ChromaService;