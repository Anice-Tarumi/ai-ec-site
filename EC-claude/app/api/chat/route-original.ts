import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { Product } from '../../types';

const ai = new GoogleGenAI({});

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

export async function POST(request: NextRequest) {
  try {
    const { userInput, products }: { userInput: string; products: Product[] } = await request.json();

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

    // Server-Sent Eventsのレスポンスヘッダーを設定
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    const sanitizedInput = sanitizeUserInput(userInput);
    
    // RAG検索を試行（フォールバックとして従来の検索も実装）
    let relevantProducts: Product[] = [];
    
    try {
      // 今回はサーバーサイドなので、シンプルな文字列マッチングを改良
      // 将来的にはサーバーサイドでもベクトル検索を実装可能
      const input = sanitizedInput.toLowerCase();
      
      // より高度な関連性スコアリング
      const scoredProducts = products.map(p => {
        let score = 0;
        
        // 完全一致に高いスコア
        if (p.name.toLowerCase().includes(input)) score += 10;
        if (p.category.some(cat => cat.toLowerCase().includes(input))) score += 8;
        if (p.color.some(color => color.toLowerCase().includes(input))) score += 6;
        if (p.keywords.some(keyword => keyword.toLowerCase().includes(input))) score += 5;
        
        // 部分一致に中程度のスコア
        if (p.brand.toLowerCase().includes(input)) score += 4;
        if (p.material.toLowerCase().includes(input)) score += 3;
        if (p.target.toLowerCase().includes(input)) score += 3;
        if (p.scene.toLowerCase().includes(input)) score += 3;
        if (p.description.toLowerCase().includes(input)) score += 2;
        
        // 季節・新商品ボーナス
        if (p.is_new) score += 1;
        
        return { product: p, score };
      });
      
      // スコア順でソートして関連度の高い商品を選出
      relevantProducts = scoredProducts
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map(item => item.product);
        
      // 関連商品がない場合は人気商品を表示
      if (relevantProducts.length === 0) {
        relevantProducts = products
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 15);
      }
    } catch (error) {
      console.error('Enhanced search failed, falling back:', error);
      relevantProducts = products.slice(0, 15);
    }
    
    const compressedProducts = relevantProducts.map(p => 
      `${p.id}|${p.name}|${p.brand}|${p.category.join(',')}|${p.color.join(',')}|${p.material}|${p.keywords.join(',')}|${p.target}|${p.scene}|¥${p.price}`
    ).join('\n');

    const prompt = `あなたは経験豊富なファッションアドバイザーです。高度な検索システムで選出された関連商品から、以下の基準で分類してください：

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

**検索で選出された関連商品データ（関連度順）：**
${compressedProducts}

**ユーザーの要望：** ${sanitizedInput}

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

    // ReadableStreamを作成してストリーミングレスポンスを実装
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // ストリーミング開始の通知
          controller.enqueue(`data: ${JSON.stringify({ type: 'start', message: '回答を生成中...' })}\n\n`);
          
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
              parts: [{ text: prompt }]
            }]
          });
          
          const content = response.text || '';
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
          
          if (!jsonMatch) {
            controller.enqueue(`data: ${JSON.stringify({ 
              type: 'error', 
              message: 'Invalid response format from Gemini API' 
            })}\n\n`);
            controller.close();
            return;
          }

          const jsonStr = jsonMatch[1] || jsonMatch[0];
          const aiResponse: AIResponse = JSON.parse(jsonStr);
          const validatedResponse = validateAIResponse(aiResponse, products);

          // レスポンスメッセージを文字ごとにストリーミング
          const message = validatedResponse.message;
          for (let i = 0; i < message.length; i++) {
            controller.enqueue(`data: ${JSON.stringify({ 
              type: 'token', 
              content: message[i],
              isComplete: false
            })}\n\n`);
            
            // 少し待機してタイピング効果を演出（無料なので短時間）
            await new Promise(resolve => setTimeout(resolve, 30));
          }

          // 完了通知とデータ送信
          controller.enqueue(`data: ${JSON.stringify({ 
            type: 'complete', 
            data: validatedResponse,
            isComplete: true 
          })}\n\n`);
          
          controller.close();
        } catch (error) {
          controller.enqueue(`data: ${JSON.stringify({ 
            type: 'error', 
            message: error instanceof Error ? error.message : 'サーバーエラーが発生しました。'
          })}\n\n`);
          controller.close();
        }
      }
    });

    return new Response(stream, { headers });

  } catch (error) {
    
    if (error instanceof Error && error.message.includes('Rate Limit')) {
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

    return new Response(
      JSON.stringify({
        error: 'Gemini API Error',
        message: error instanceof Error ? error.message : 'サーバーエラーが発生しました。',
        details: error instanceof Error ? error.stack : 'Unknown error',
        errorType: error?.constructor?.name,
        errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
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