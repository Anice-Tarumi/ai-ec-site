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
  console.log('🚀 API リクエスト受信');
  try {
    const { userInput, products }: { userInput: string; products: Product[] } = await request.json();
    console.log('📝 リクエストデータ:', { userInput, productsCount: products?.length });

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
    
    const systemPrompt = createSystemPrompt(ragContext, sanitizedInput);
    console.log('📝 システムプロンプト生成完了');

    // Gemini API設定確認
    console.log('🔑 APIキー確認:', {
      hasKey: !!process.env.GEMINI_API_KEY,
      keyLength: process.env.GEMINI_API_KEY?.length,
      keyPrefix: process.env.GEMINI_API_KEY?.substring(0, 10)
    });

    // AI SDKのstreamTextを使用してストリーミング実装
    console.log('🤖 Gemini API呼び出し開始');
    
    try {
      const result = streamText({
        model: google('gemini-1.5-flash'),
        prompt: `${systemPrompt}\n\n**ユーザーの質問**: ${sanitizedInput}`,
        temperature: 0.7,
        onFinish: async ({ text }) => {
          console.log('✅ AI応答完了:', text.length, 'characters');
        }
      });

      console.log('🚀 ストリーミングレスポンス返却');
      return result.toTextStreamResponse();
    } catch (streamError) {
      console.error('💥 streamText エラー:', streamError);
      throw streamError;
    }

  } catch (error) {
    console.error('❌ API エラー発生:', error);
    
    if (error instanceof Error && error.message.includes('Rate Limit')) {
      console.error('📊 レート制限エラー');
      return new Response(
        JSON.stringify({
          error: 'Rate Limit',
          message: 'APIのレート制限に達しました。しばらく時間を置いてから再試行してください。'
        }),
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.error('🔥 詳細エラー情報:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack',
      name: error instanceof Error ? error.name : 'Unknown',
      hasApiKey: !!process.env.GEMINI_API_KEY,
      apiKeyLength: process.env.GEMINI_API_KEY?.length
    });

    return new Response(
      JSON.stringify({
        error: 'Gemini API Error',
        message: error instanceof Error ? error.message : 'サーバーエラーが発生しました。',
        details: error instanceof Error ? error.stack : 'Unknown error',
        errorType: error?.constructor?.name,
        context: {
          hasApiKey: !!process.env.GEMINI_API_KEY,
          apiKeyLength: process.env.GEMINI_API_KEY?.length
        }
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
  
  const scoredProducts = products.map(p => {
    let score = 0;
    
    // 完全一致に高いスコア
    if (p.name.toLowerCase().includes(lowerInput)) score += 10;
    if (p.category.some(cat => cat.toLowerCase().includes(lowerInput))) score += 8;
    if (p.color.some(color => color.toLowerCase().includes(lowerInput))) score += 6;
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
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
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

// システムプロンプト生成
function createSystemPrompt(ragContext: RAGContext, userInput: string): string {
  const compressedProducts = ragContext.relevantProducts.map(p => 
    `${p.id}|${p.name}|${p.brand}|${p.category.join(',')}|${p.color.join(',')}|${p.material}|${p.keywords.join(',')}|${p.target}|${p.scene}|¥${p.price}`
  ).join('\n');
  
  return `あなたは経験豊富なファッションアドバイザーです。RAGシステムで選出された関連商品から、以下の基準で分類してください：

**商品分類基準：**
1. **main_products**: ユーザーの要望に最も適合する商品（3-5点）
   - 指定された色・アイテム・スタイルに最も適合
   - 価格帯や年齢層もユーザーの要望に合致
   - 用途・シーンが一致

2. **sub_products**: main_productsと組み合わせできるコーディネート商品（3-8点）
   - 色の相性（同系色・補色・モノトーン・アクセントカラー）
   - スタイル統一（フォーマル、カジュアル、エレガント等）
   - シーン適合性（オフィス、デート、普段着等）
   - レイヤリングや組み合わせが可能

3. **related_products**: 代替案や類似商品（2-5点）
   - 同じカテゴリで異なる色・デザイン・価格帯
   - 似たターゲット層・用途
   - 季節やトレンドを考慮した選択肢

**RAGで選出された関連商品データ（関連度順）：**
${compressedProducts}

**検索スコア**: ${ragContext.searchScore.toFixed(2)}
**関連商品数**: ${ragContext.relevantProducts.length}点

以下のJSON形式で回答してください：
\`\`\`json
{
  "summary": "ユーザーの要望を30文字以内で要約",
  "main_products": ["最適な商品ID"],
  "sub_products": ["コーディネート商品ID"],
  "related_products": ["関連・代替商品ID"],
  "message": "選択理由とスタイリング提案を100文字以内で",
  "markdown_paths": []
}
\`\`\`

提供された商品IDのみを使用し、より精度の高い分類を行ってください。`;
}

function validateAIResponse(response: AIResponse, products: Product[]): AIResponse {
  const productIds = products.map(p => p.id);
  
  const filterValidIds = (ids: string[]) => ids.filter(id => productIds.includes(id));
  
  return {
    summary: response.summary?.substring(0, 100) || 'お探しの商品について',
    main_products: filterValidIds(response.main_products || []),
    sub_products: filterValidIds(response.sub_products || []),
    related_products: filterValidIds(response.related_products || []),
    message: response.message?.substring(0, 150) || 'おすすめの商品をご提案いたします！',
    markdown_paths: response.markdown_paths || []
  };
}