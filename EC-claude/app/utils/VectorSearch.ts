import { pipeline } from '@xenova/transformers';
import { Product } from '../types';

interface ProductVector {
  id: string;
  vector: number[];
  text: string;
}

interface SearchResult {
  product: Product;
  score: number;
}

class VectorSearch {
  private embedder: any = null;
  private productVectors: ProductVector[] = [];
  private products: Product[] = [];

  async initialize() {
    if (!this.embedder) {
      try {
        // 軽量な日本語対応Embeddingモデルを使用
        this.embedder = await pipeline(
          'feature-extraction',
          'Xenova/multilingual-e5-small'
        );
      } catch (error) {
        console.error('Embedding model initialization failed:', error);
        // フォールバック：シンプルなembedding
        this.embedder = null;
      }
    }
  }

  // 商品データをベクトル化して保存
  async indexProducts(products: Product[]) {
    await this.initialize();
    this.products = products;
    
    if (!this.embedder) {
      console.warn('Embedding model not available, using fallback search');
      return;
    }

    console.log('Vectorizing products...');
    
    for (const product of products) {
      try {
        // 商品の検索可能テキストを作成
        const searchText = this.createSearchText(product);
        
        // ベクトル化
        const result = await this.embedder(searchText);
        const vector = Array.from(result.data) as number[];

        this.productVectors.push({
          id: product.id,
          vector,
          text: searchText
        });
      } catch (error) {
        console.error(`Failed to vectorize product ${product.id}:`, error);
      }
    }
    
    console.log(`Indexed ${this.productVectors.length} products`);
  }

  // 商品情報を検索可能なテキストに変換
  private createSearchText(product: Product): string {
    return [
      product.name,
      product.brand,
      product.category.join(' '),
      product.color.join(' '),
      product.material,
      product.description,
      product.keywords.join(' '),
      product.target,
      product.scene,
      product.recommend_for,
      product.season,
      `価格${product.price}円`
    ].join(' ');
  }

  // クエリに基づいて類似商品を検索
  async searchSimilar(query: string, topK: number = 10): Promise<SearchResult[]> {
    if (!this.embedder || this.productVectors.length === 0) {
      // フォールバック：従来の文字列マッチング
      return this.fallbackSearch(query, topK);
    }

    try {
      // クエリをベクトル化
      const queryResult = await this.embedder(query);
      const queryVector = Array.from(queryResult.data) as number[];

      // 全商品との類似度を計算
      const similarities: { id: string; score: number }[] = [];
      
      for (const productVector of this.productVectors) {
        const similarity = this.cosineSimilarity(queryVector, productVector.vector);
        similarities.push({
          id: productVector.id,
          score: similarity
        });
      }

      // 類似度でソートして上位K件を取得
      const topResults = similarities
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      // 商品データと組み合わせて返す
      return topResults.map(result => {
        const product = this.products.find(p => p.id === result.id);
        return {
          product: product!,
          score: result.score
        };
      }).filter(result => result.product);

    } catch (error) {
      console.error('Vector search failed:', error);
      return this.fallbackSearch(query, topK);
    }
  }

  // フォールバック検索（従来の文字列マッチング）
  private fallbackSearch(query: string, topK: number): SearchResult[] {
    const lowerQuery = query.toLowerCase();
    
    const matches = this.products.filter(product => {
      return (
        product.name.toLowerCase().includes(lowerQuery) ||
        product.category.some(cat => lowerQuery.includes(cat.toLowerCase())) ||
        product.color.some(color => lowerQuery.includes(color.toLowerCase())) ||
        product.keywords.some(keyword => lowerQuery.includes(keyword.toLowerCase())) ||
        product.brand.toLowerCase().includes(lowerQuery) ||
        product.material.toLowerCase().includes(lowerQuery) ||
        product.target.toLowerCase().includes(lowerQuery) ||
        product.scene.toLowerCase().includes(lowerQuery)
      );
    });

    return matches.slice(0, topK).map(product => ({
      product,
      score: 0.5 // ダミースコア
    }));
  }

  // コサイン類似度の計算
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }

  // ベクトルデータの保存（オプション）
  async saveVectors() {
    if (typeof window !== 'undefined') {
      // ブラウザ環境ではLocalStorageに保存
      localStorage.setItem('productVectors', JSON.stringify(this.productVectors));
    }
  }

  // ベクトルデータの読み込み（オプション）
  async loadVectors() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('productVectors');
      if (saved) {
        this.productVectors = JSON.parse(saved);
      }
    }
  }
}

export default VectorSearch;