import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { Product } from '../../types';

const ai = new GoogleGenAI({});

// プロンプトインジェクション対策関数
function sanitizeUserInput(input: string): string {
  // 危険なパターンをフィルタリング
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

  // 長すぎる入力を制限
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500) + '...';
  }

  return sanitized;
}


// AIレスポンスの型定義
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
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return NextResponse.json(
        { 
          error: 'Gemini API key is not configured',
          message: 'APIキーが設定されていません。.env.localファイルに正しいGeminiAPIキーを設定してください。',
          details: 'https://makersuite.google.com/app/apikey からAPIキーを取得してください。'
        },
        { status: 500 }
      );
    }

    // プロンプトインジェクション対策
    const sanitizedInput = sanitizeUserInput(userInput);


    // スマート商品フィルタリング
    const input = sanitizedInput.toLowerCase();
    
    let relevantProducts = products.filter(p => {
      return (
        p.name.toLowerCase().includes(input) ||
        p.category.some(cat => input.includes(cat.toLowerCase())) ||
        p.color.some(color => input.includes(color.toLowerCase())) ||
        p.keywords.some(keyword => input.includes(keyword.toLowerCase())) ||
        p.brand.toLowerCase().includes(input) ||
        p.material.toLowerCase().includes(input) ||
        p.target.toLowerCase().includes(input) ||
        p.scene.toLowerCase().includes(input)
      );
    }); // 制限を削除して全ての関連商品を表示
    
    if (relevantProducts.length === 0) {
      relevantProducts = products.slice(0, 15); // デフォルトは15件
    }
    
    // 詳細商品データ（AIが適切に判断できるよう必要な情報を含める）
    const compressedProducts = relevantProducts.map(p => 
      `${p.id}|${p.name}|${p.brand}|${p.category.join(',')}|${p.color.join(',')}|${p.material}|${p.keywords.join(',')}|${p.target}|${p.scene}|¥${p.price}`
    ).join('\n');

    const prompt = `あなたは経験豊富なファッションアドバイザーです。以下の明確な基準で商品を分類してください：

**商品分類基準：**
1. **main_products**: ユーザーの要望に直接合致する商品
   - 指定された色・アイテム・スタイルに最も適合
   - 価格帯や年齢層もユーザーの要望に合致

2. **sub_products**: main_productsとコーディネートできる商品
   - 色の相性が良い（同系色・補色・モノトーン）
   - シーン・用途が一致（オフィス、カジュアル、デートなど）
   - スタイルが統一される（エレガント、カジュアル、ビジネスなど）

3. **related_products**: 類似性や代替案となる商品
   - 同じカテゴリで異なる色・デザイン
   - 似た価格帯・ターゲット層
   - 同じ用途・シーンで使える

商品データ（ID|商品名|ブランド|カテゴリ|色|素材|キーワード|対象|用途|価格）：
${compressedProducts}

ユーザーの要望：${sanitizedInput}

以下のJSON形式で回答してください：
\`\`\`json
{
  "summary": "ユーザーの要望を30文字以内で要約",
  "main_products": ["直接的におすすめの商品ID（全て）"],
  "sub_products": ["コーディネート用商品ID（全て）"],
  "related_products": ["関連・類似商品ID（全て）"],
  "message": "分類理由とスタイリング提案を100文字以内で",
  "markdown_paths": []
}
\`\`\`

各商品を上記基準で分類し、提供された商品IDのみを使用してください。`;

    // Gemini API呼び出し
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        parts: [{ text: prompt }]
      }]
    });
    const content = response.text || '';
    
    
    // JSONを抽出
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      throw new Error('Invalid response format from Gemini API');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const aiResponse: AIResponse = JSON.parse(jsonStr);

    // レスポンスの検証
    const validatedResponse = validateAIResponse(aiResponse, products);

    return NextResponse.json(validatedResponse);

  } catch (error) {
    
    if (error instanceof Error && error.message.includes('Rate Limit')) {
      return NextResponse.json(
        {
          error: 'Rate Limit',
          message: 'APIのレート制限に達しました。しばらく時間を置いてから再試行してください。'
        },
        { status: 429 }
      );
    }

    // 詳細なエラー情報を返す（デバッグ用）
    return NextResponse.json(
      {
        error: 'Gemini API Error',
        message: error instanceof Error ? error.message : 'サーバーエラーが発生しました。',
        details: error instanceof Error ? error.stack : 'Unknown error',
        errorType: error?.constructor?.name,
        errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        context: {
          hasApiKey: !!process.env.GEMINI_API_KEY,
          apiKeyLength: process.env.GEMINI_API_KEY?.length
        }
      },
      { status: 500 }
    );
  }
}

// AIレスポンスの検証関数
function validateAIResponse(response: AIResponse, products: Product[]): AIResponse {
  const productIds = products.map(p => p.id);
  
  // 存在しない商品IDを除去
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