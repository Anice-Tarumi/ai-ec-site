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
  
  // スコア順でソートして関連度の高い商品を選出（より厳しいフィルタ）
  const relevantProducts = scoredProducts
    .filter(item => item.score > 2)  // より厳しいフィルタリング
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)  // 20から15に減らして精度向上
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
  // ユーザーの色指定を検出
  const lowerInput = userInput.toLowerCase();
  const colorKeywords = ['黒', '白', '赤', '青', '緑', '黄', 'ピンク', 'グレー', 'ネイビー', 'ベージュ', 'ブラウン'];
  const requestedColors = colorKeywords.filter(color => lowerInput.includes(color));
  
  const compressedProducts = ragContext.relevantProducts.map(p => {
    // 指定色がある場合、その色を優先表示
    let colorInfo = p.color.join(',');
    if (requestedColors.length > 0) {
      const matchingColors = p.color.filter(c => 
        requestedColors.some(requested => c.includes(requested))
      );
      if (matchingColors.length > 0) {
        colorInfo = matchingColors.join(',') + `(${p.color.join(',')}展開)`;
      }
    }
    
    return `${p.id}|${p.name}|${p.brand}|${p.category.join(',')}|${colorInfo}|${p.material}|${p.keywords.join(',')}|${p.target}|${p.scene}|¥${p.price}`;
  }).join('\n');
  
  const colorInstruction = requestedColors.length > 0 
    ? `\n**カラーコーディネート指針**: ユーザーは「${requestedColors.join('、')}」色を中心としたスタイリングを希望しています。以下の観点で提案してください：
    - メイン商品：指定色の商品を中心に
    - コーディネート商品：指定色と調和する色合い（補色・同系色・アクセントカラー）
    - 関連商品：トータルコーディネートを考慮した提案
    - 必ず各商品を選んだ理由とコーディネートのポイントを説明してください`
    : '';
  
  return `あなたは10年以上の経験を持つプロのファッションスタイリストです。以下のファッション知識を活用してください：

**色彩理論**:
- モノトーン（黒白グレー）: 洗練・クール・大人っぽい
- 補色（赤×緑、青×オレンジ）: インパクト・個性的
- 同系色: 統一感・上品・落ち着き
- アクセントカラー: 小物で差し色

**スタイリング原則**:
- 対比の法則: タイト×ルーズ、フォーマル×カジュアル
- 3色ルール: 基本色2色+アクセント1色
- 縦ラインで細見え、横ラインでボリューム
- 季節感: 春夏は軽やか、秋冬は重厚感

**シーン別アプローチ**:
- オフィス: 品格・信頼感・清潔感
- デート: 女性らしさ・上品さ・親しみやすさ  
- カジュアル: リラックス・動きやすさ・個性

単なる商品紹介ではなく、「なぜその組み合わせなのか」「どんな印象を与えるか」「どう着こなすか」まで考えて提案してください。${colorInstruction}

**検索された関連商品（関連度順）：**
${compressedProducts}

**検索スコア**: ${ragContext.searchScore.toFixed(2)}
**関連商品数**: ${ragContext.relevantProducts.length}点

ユーザーの要望に対して、自然で親しみやすい文章でファッションアドバイスを提供してください。
商品の具体的な紹介や着こなし方法、コーディネートのポイントを分かりやすく説明してください。
回答は100-200文字程度で簡潔にまとめてください。`;
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