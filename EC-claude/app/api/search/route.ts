import { NextRequest } from 'next/server';
import ChromaService from '../../utils/ChromaService';
import DatabaseClient from '../../utils/DatabaseClient';
import { Product } from '../../types';

export const runtime = 'nodejs';
export const maxDuration = 25;

interface SearchResponse {
  products: Product[];
  searchScore: number;
  totalFound: number;
  searchTimeMs: number;
  searchType: 'vector' | 'fallback';
}

export async function POST(request: NextRequest) {
  console.log('🔍 RAG Search API called');
  const startTime = Date.now();

  try {
    const { query, nResults = 10 } = await request.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required and must be a string' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('📝 Search query:', query);
    console.log('📊 Results requested:', nResults);

    // ChromaDB + Gemini でベクトル検索
    const chromaService = new ChromaService();
    const dbClient = new DatabaseClient();

    let searchType: 'vector' | 'fallback' = 'vector';
    let products: Product[] = [];
    let searchScore = 0;

    try {
      // 1. ベクトル検索実行
      console.log('🤖 Starting vector search...');
      const vectorResults = await chromaService.searchByQuery(query, { 
        nResults: Math.min(nResults * 2, 20) // 多めに取得してフィルタリング
      });

      if (vectorResults.length === 0) {
        console.log('⚠️ No vector results found, falling back to traditional search');
        throw new Error('No vector results');
      }

      // 2. 商品IDを抽出
      const productIds = vectorResults.map(result => result.id);
      console.log('📋 Found product IDs:', productIds);

      // 3. PostgreSQLから詳細な商品データを取得
      console.log('🗄️ Fetching product details from PostgreSQL...');
      products = await dbClient.getProductsByIds(productIds);

      // 4. 距離スコアを計算（ChromaDBの距離は小さいほど類似）
      const avgDistance = vectorResults.reduce((sum, r) => sum + r.distance, 0) / vectorResults.length;
      searchScore = Math.max(0, 1 - avgDistance); // 0-1の類似度スコアに変換

      console.log('✅ Vector search completed:', {
        vectorResults: vectorResults.length,
        productsFound: products.length,
        avgDistance,
        searchScore
      });

    } catch (vectorError) {
      console.log('⚠️ Vector search failed, using fallback:', vectorError);
      searchType = 'fallback';

      // フォールバック：従来の文字列検索
      const searchOptions = {
        keywords: query,
        limit: nResults,
        sortBy: 'rating' as const,
        sortOrder: 'desc' as const
      };

      const searchResult = await dbClient.searchProducts(searchOptions);
      products = searchResult.products;
      searchScore = 0.5; // フォールバック時の固定スコア
      
      console.log('✅ Fallback search completed:', {
        productsFound: products.length,
        totalAvailable: searchResult.total
      });
    }

    // 検索時間測定
    const endTime = Date.now();
    const searchTimeMs = endTime - startTime;

    // 検索履歴を保存（バックグラウンド）
    dbClient.saveSearchHistory({
      query,
      searchType,
      resultsCount: products.length,
      searchTimeMs
    }).catch(err => console.error('Failed to save search history:', err));

    const response: SearchResponse = {
      products,
      searchScore,
      totalFound: products.length,
      searchTimeMs,
      searchType
    };

    console.log('✅ Search API completed:', {
      searchType,
      productsReturned: products.length,
      searchTimeMs,
      searchScore
    });

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const endTime = Date.now();
    const searchTimeMs = endTime - startTime;
    
    console.error('❌ Search API Error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Search API Error',
        message: error instanceof Error ? error.message : 'RAG検索でエラーが発生しました。',
        searchTimeMs,
        searchType: 'error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}