import { Pool, PoolClient } from 'pg';
import { Product } from '../types';

export interface ProductSearchOptions {
  limit?: number;
  offset?: number;
  category?: string[];
  brands?: string[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  keywords?: string;
  isNew?: boolean;
  season?: string;
  sortBy?: 'price' | 'rating' | 'reviews' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchHistoryEntry {
  query: string;
  vectorId?: string;
  searchType: 'vector' | 'hybrid' | 'traditional';
  resultsCount: number;
  searchTimeMs: number;
}

class DatabaseClient {
  private pool: Pool | null = null;

  // データベース接続初期化
  async initialize() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // 接続テスト
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('✅ PostgreSQL connected successfully');
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error);
      throw error;
    }
  }

  // 接続取得
  private async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      await this.initialize();
    }
    return this.pool!.connect();
  }

  // 商品データの一括挿入
  async insertProducts(products: Product[]) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // 既存データの削除（開発用）
      await client.query('DELETE FROM products');
      
      // バッチ挿入
      const batchSize = 100;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        
        const values = batch.map((product, index) => {
          const baseIndex = i * 13 + index * 13;
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19})`;
        }).join(', ');
        
        const params = batch.flatMap(product => [
          product.id,
          product.name,
          product.brand,
          JSON.stringify(product.category),
          product.price,
          JSON.stringify(product.size),
          JSON.stringify(product.color),
          product.material,
          product.description,
          JSON.stringify(product.keywords),
          product.target,
          product.scene,
          product.recommend_for,
          product.catchcopy,
          product.image,
          product.rating,
          product.reviews,
          product.is_new,
          product.season
        ]);
        
        const query = `
          INSERT INTO products (
            id, name, brand, category, price, size, color, material, 
            description, keywords, target, scene, recommend_for, 
            catchcopy, image, rating, reviews, is_new, season
          ) VALUES ${values}
        `;
        
        await client.query(query, params);
        console.log(`📤 Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);
      }
      
      await client.query('COMMIT');
      console.log(`✅ Inserted ${products.length} products into PostgreSQL`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to insert products:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // 商品IDで検索
  async getProductById(id: string): Promise<Product | null> {
    const client = await this.getClient();
    
    try {
      const result = await client.query(
        'SELECT * FROM products WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) return null;
      
      return this.mapRowToProduct(result.rows[0]);
    } finally {
      client.release();
    }
  }

  // 複数商品IDで検索
  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    
    const client = await this.getClient();
    
    try {
      const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
      const result = await client.query(
        `SELECT * FROM products WHERE id IN (${placeholders}) ORDER BY rating DESC`,
        ids
      );
      
      return result.rows.map(row => this.mapRowToProduct(row));
    } finally {
      client.release();
    }
  }

  // 商品検索（フィルター付き）
  async searchProducts(options: ProductSearchOptions = {}): Promise<{
    products: Product[];
    total: number;
  }> {
    const client = await this.getClient();
    
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // フィルター条件の構築
      if (options.category && options.category.length > 0) {
        conditions.push(`category @> $${paramIndex}`);
        params.push(JSON.stringify(options.category));
        paramIndex++;
      }

      if (options.brands && options.brands.length > 0) {
        conditions.push(`brand = ANY($${paramIndex})`);
        params.push(options.brands);
        paramIndex++;
      }

      if (options.colors && options.colors.length > 0) {
        conditions.push(`color && $${paramIndex}`);
        params.push(options.colors);
        paramIndex++;
      }

      if (options.minPrice !== undefined) {
        conditions.push(`price >= $${paramIndex}`);
        params.push(options.minPrice);
        paramIndex++;
      }

      if (options.maxPrice !== undefined) {
        conditions.push(`price <= $${paramIndex}`);
        params.push(options.maxPrice);
        paramIndex++;
      }

      if (options.keywords) {
        conditions.push(`(
          to_tsvector('japanese', name) @@ plainto_tsquery('japanese', $${paramIndex}) OR
          to_tsvector('japanese', description) @@ plainto_tsquery('japanese', $${paramIndex}) OR
          keywords @> $${paramIndex + 1}
        )`);
        params.push(options.keywords, JSON.stringify([options.keywords]));
        paramIndex += 2;
      }

      if (options.isNew !== undefined) {
        conditions.push(`is_new = $${paramIndex}`);
        params.push(options.isNew);
        paramIndex++;
      }

      if (options.season) {
        conditions.push(`season = $${paramIndex}`);
        params.push(options.season);
        paramIndex++;
      }

      // WHERE句の構築
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // ORDER BY句の構築
      const sortBy = options.sortBy || 'rating';
      const sortOrder = options.sortOrder || 'desc';
      const orderBy = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // LIMIT/OFFSET
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      // 総数取得
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM products ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // データ取得
      const dataResult = await client.query(
        `SELECT * FROM products ${whereClause} ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const products = dataResult.rows.map(row => this.mapRowToProduct(row));

      return { products, total };
    } finally {
      client.release();
    }
  }

  // 検索履歴の保存
  async saveSearchHistory(entry: SearchHistoryEntry) {
    const client = await this.getClient();
    
    try {
      await client.query(
        `INSERT INTO search_history (query, vector_id, search_type, results_count, search_time_ms) 
         VALUES ($1, $2, $3, $4, $5)`,
        [entry.query, entry.vectorId, entry.searchType, entry.resultsCount, entry.searchTimeMs]
      );
    } finally {
      client.release();
    }
  }

  // 統計情報取得
  async getProductStats() {
    const client = await this.getClient();
    
    try {
      const result = await client.query('SELECT get_product_stats() as stats');
      return result.rows[0].stats;
    } finally {
      client.release();
    }
  }

  // カテゴリ別統計
  async getCategoryStats() {
    const client = await this.getClient();
    
    try {
      const result = await client.query('SELECT * FROM product_category_stats');
      return result.rows;
    } finally {
      client.release();
    }
  }

  // 人気商品取得
  async getPopularProducts(limit: number = 20) {
    const client = await this.getClient();
    
    try {
      const result = await client.query(
        'SELECT * FROM popular_products LIMIT $1',
        [limit]
      );
      return result.rows.map(row => this.mapRowToProduct(row));
    } finally {
      client.release();
    }
  }

  // 新商品取得
  async getNewProducts(limit: number = 20) {
    const client = await this.getClient();
    
    try {
      const result = await client.query(
        'SELECT * FROM new_products LIMIT $1',
        [limit]
      );
      return result.rows.map(row => this.mapRowToProduct(row));
    } finally {
      client.release();
    }
  }

  // データベース行を商品オブジェクトにマップ
  private mapRowToProduct(row: any): Product {
    return {
      id: row.id,
      name: row.name,
      brand: row.brand,
      category: Array.isArray(row.category) ? row.category : JSON.parse(row.category),
      price: row.price,
      size: Array.isArray(row.size) ? row.size : JSON.parse(row.size),
      color: Array.isArray(row.color) ? row.color : JSON.parse(row.color),
      material: row.material,
      description: row.description,
      keywords: Array.isArray(row.keywords) ? row.keywords : JSON.parse(row.keywords),
      target: row.target,
      scene: row.scene,
      recommend_for: row.recommend_for,
      catchcopy: row.catchcopy,
      image: row.image,
      rating: parseFloat(row.rating),
      reviews: row.reviews,
      is_new: row.is_new,
      season: row.season,
    };
  }

  // 接続終了
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 PostgreSQL connection closed');
    }
  }
}

export default DatabaseClient;