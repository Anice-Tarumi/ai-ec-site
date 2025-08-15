import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { Product } from '../../types';

function sanitizeUserInput(input: string): string {
  const dangerousPatterns = [
    /ignore\s+previous\s+instructions?/gi,
    /forget\s+everything/gi,
    /system\s*:/gi,
    /assistant\s*:/gi,
    /you\s+are\s+now/gi,
    /pretend\s+to\s+be/gi,
    /act\s+as/gi,
    /role\s*:\s*system/gi,
    /<\s*system\s*>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
  ];

  let sanitized = input;
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  });

  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500) + '...';
  }

  return sanitized;
}

interface AIResponse {
  summary: string;
  main_products: string[];
  sub_products: string[];
  related_products: string[];
  message: string;
  markdown_paths: string[];
}

interface RAGContext {
  relevantProducts: Product[];
  searchScore: number;
}

export async function POST(request: NextRequest) {
  console.log('🔍 RAG Filter API リクエスト受信');
  try {
    const { userInput }: { userInput: string } = await request.json();
    console.log('📝 Filter リクエストデータ:', { userInput });

    if (!userInput) {
      return new Response(
        JSON.stringify({ error: 'userInput is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const sanitizedInput = sanitizeUserInput(userInput);
    
    // 新しい RAG 検索を使用
    console.log('🔍 RAG検索API呼び出し開始');
    const searchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: sanitizedInput,
        nResults: 15
      })
    });

    if (!searchResponse.ok) {
      throw new Error(`Search API failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    console.log('📊 RAG検索結果:', {
      productsFound: searchData.products?.length || 0,
      searchScore: searchData.searchScore,
      searchType: searchData.searchType,
      searchTimeMs: searchData.searchTimeMs
    });

    const relevantProducts = searchData.products || [];

    if (relevantProducts.length === 0) {
      const responseData = {
        summary: `${sanitizedInput}に関連する商品が見つかりませんでした`,
        main_products: [],
        sub_products: [],
        related_products: [],
        message: "検索条件を変えてお試しください",
        markdown_paths: []
      };

      return new Response(
        `\`\`\`json\n${JSON.stringify(responseData, null, 2)}\n\`\`\``,
        { 
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    }

    // 商品を3つのカテゴリに分類
    const responseData = {
      summary: `${sanitizedInput}の検索結果（${relevantProducts.length}件）`,
      main_products: relevantProducts.slice(0, 3).map((p: Product) => p.id),
      sub_products: relevantProducts.slice(3, 8).map((p: Product) => p.id),
      related_products: relevantProducts.slice(8, 15).map((p: Product) => p.id),
      message: `ベクトル検索で${relevantProducts.length}件の関連商品が見つかりました（検索スコア: ${searchData.searchScore?.toFixed(3) || 'N/A'}）`,
      markdown_paths: []
    };

    console.log('✅ Filter処理完了:', {
      mainProducts: responseData.main_products.length,
      subProducts: responseData.sub_products.length,
      relatedProducts: responseData.related_products.length
    });

    return new Response(
      `\`\`\`json\n${JSON.stringify(responseData, null, 2)}\n\`\`\``,
      { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      }
    );

  } catch (error) {
    console.error('❌ Filter API エラー発生:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Filter API Error',
        message: error instanceof Error ? error.message : 'フィルターAPIでエラーが発生しました。',
        details: error instanceof Error ? error.stack : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

