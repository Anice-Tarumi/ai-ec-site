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
  console.log('🔍 Filter API リクエスト受信');
  try {
    const { userInput, products }: { userInput: string; products: Product[] } = await request.json();
    console.log('📝 Filter リクエストデータ:', { userInput, productsCount: products?.length });

    if (!userInput || !products) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return new Response(
        JSON.stringify({ 
          error: 'Gemini API key is not configured',
          message: 'APIキーが設定されていません。.env.localファイルに正しいGeminiAPIキーを設定してください。',
          details: 'https://makersuite.google.com/app/apikey からAPIキーを取得してください。'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const sanitizedInput = sanitizeUserInput(userInput);
    
    // RAG検索：商品の関連性スコアリング
    console.log('🔍 RAG検索の準備完了');
    const ragContext = performRAGSearch(sanitizedInput, products);
    console.log('📊 関連商品数:', ragContext.relevantProducts.length);
    
    const systemPrompt = createFilterPrompt(ragContext, sanitizedInput);
    console.log('📝 フィルタープロンプト生成完了');

    console.log('🤖 Filter API呼び出し開始');
    
    // デバッグ用：固定JSONレスポンスを返す
    return new Response(
      `\`\`\`json
{
  "summary": "赤い服を探しています",
  "main_products": ["test1"],
  "sub_products": [],
  "related_products": [],
  "message": "デバッグ用の固定レスポンス",
  "markdown_paths": []
}
\`\`\``,
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

// RAG検索：商品の関連性スコアリング
function performRAGSearch(input: string, products: Product[]): RAGContext {
  const lowerInput = input.toLowerCase();
  
  // 色キーワードの検出
  const colorKeywords = ['黒', '白', '赤', '青', '緑', '黄', 'ピンク', 'グレー', 'ネイビー', 'ベージュ', 'ブラウン'];
  const requestedColors = colorKeywords.filter(color => lowerInput.includes(color));
  
  const scoredProducts = products.map(p => {
    let score = 0;
    
    // 色の厳密フィルタリング
    if (requestedColors.length > 0) {
      const hasRequestedColor = requestedColors.some(color => 
        p.color.some(productColor => productColor.includes(color))
      );
      if (hasRequestedColor) {
        score += 12; // 指定色があれば最高スコア
      } else {
        score -= 3;  // 指定色がなければマイナス
      }
    }
    
    // 完全一致に高いスコア
    if (p.name.toLowerCase().includes(lowerInput)) score += 10;
    if (p.category.some(cat => cat.toLowerCase().includes(lowerInput))) score += 8;
    if (p.keywords.some(keyword => keyword.toLowerCase().includes(lowerInput))) score += 5;
    
    // 部分一致に中程度のスコア
    if (p.brand.toLowerCase().includes(lowerInput)) score += 4;
    if (p.material.toLowerCase().includes(lowerInput)) score += 3;
    if (p.target.toLowerCase().includes(lowerInput)) score += 3;
    if (p.scene.toLowerCase().includes(lowerInput)) score += 3;
    if (p.description.toLowerCase().includes(lowerInput)) score += 2;
    
    // 季節・新商品ボーナス
    if (p.is_new) score += 1;
    
    return { product: p, score };
  });
  
  // スコア順でソートして関連度の高い商品を選出
  const relevantProducts = scoredProducts
    .filter(item => item.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(item => item.product);
    
  // 関連商品がない場合は人気商品を表示
  const finalProducts = relevantProducts.length > 0 
    ? relevantProducts 
    : products.sort((a, b) => b.rating - a.rating).slice(0, 15);
    
  const avgScore = scoredProducts.reduce((sum, item) => sum + item.score, 0) / scoredProducts.length;
  
  return {
    relevantProducts: finalProducts,
    searchScore: avgScore
  };
}

// フィルター用システムプロンプト生成
function createFilterPrompt(ragContext: RAGContext, userInput: string): string {
  const compressedProducts = ragContext.relevantProducts.map(p => {
    return `${p.id}|${p.name}|${p.brand}|${p.category.join(',')}|${p.color.join(',')}|${p.material}|${p.keywords.join(',')}|${p.target}|${p.scene}|¥${p.price}`;
  }).join('\n');
  
  return `あなたは商品フィルタリングシステムです。ユーザーの要望に基づいて商品IDを分類してください。

**検索された関連商品（関連度順）：**
${compressedProducts}

**検索スコア**: ${ragContext.searchScore.toFixed(2)}
**関連商品数**: ${ragContext.relevantProducts.length}点

以下のJSON形式で商品IDを分類してください：

\`\`\`json
{
  "summary": "要望を20文字で要約",
  "main_products": ["最も重要な商品ID（最大3個）"],
  "sub_products": ["コーディネート商品ID（最大5個）"],
  "related_products": ["関連商品ID（最大7個）"],
  "message": "選んだ理由を50文字以内",
  "markdown_paths": []
}
\`\`\`

提供された商品IDのみを使用してください。`;
}