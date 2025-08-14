import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { Product } from '../../types';
import RAGService, { RAGSearchOptions } from '../../utils/RAGService';

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
  search_info?: {
    searchType: string;
    totalResults: number;
    searchTimeMs: number;
  };
}

interface RAGContext {
  relevantProducts: Product[];
  searchType: string;
  totalResults: number;
  searchTimeMs: number;
  relevanceScores?: { [productId: string]: number };
}

export async function POST(request: NextRequest) {
  console.log('🚀 RAG API リクエスト受信');
  const startTime = Date.now();
  
  try {
    const { userInput, products: fallbackProducts }: { userInput: string; products?: Product[] } = await request.json();
    console.log('📝 リクエストデータ:', { userInput, hasFallbackProducts: !!fallbackProducts });

    if (!userInput) {
      return new Response(
        JSON.stringify({ error: 'Missing userInput parameter' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // API キーチェック
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
    
    // RAG検索の実行
    console.log('🔍 RAG検索を開始...');
    let ragContext: RAGContext;
    
    try {
      ragContext = await performRAGSearch(sanitizedInput, fallbackProducts);
      console.log('📊 RAG検索結果:', {
        searchType: ragContext.searchType,
        relevantProducts: ragContext.relevantProducts.length,
        totalResults: ragContext.totalResults,
        searchTimeMs: ragContext.searchTimeMs
      });
    } catch (ragError) {
      console.warn('⚠️ RAG検索でエラーが発生、フォールバックを使用:', ragError);
      
      // フォールバック: 従来の検索
      ragContext = performFallbackSearch(sanitizedInput, fallbackProducts || []);
    }
    
    const systemPrompt = createRAGSystemPrompt(ragContext, sanitizedInput);
    console.log('📝 RAGシステムプロンプト生成完了');

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
          const totalTime = Date.now() - startTime;
          console.log('✅ AI応答完了:', {
            responseLength: text.length,
            totalTimeMs: totalTime,
            searchTimeMs: ragContext.searchTimeMs,
            aiTimeMs: totalTime - ragContext.searchTimeMs
          });
        }
      });

      console.log('🚀 RAGストリーミングレスポンス返却');
      return result.toTextStreamResponse();
    } catch (streamError) {
      console.error('💥 streamText エラー:', streamError);
      throw streamError;
    }

  } catch (error) {
    console.error('❌ RAG API エラー発生:', error);
    
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
        error: 'RAG API Error',
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

// RAG検索の実行
async function performRAGSearch(input: string, fallbackProducts?: Product[]): Promise<RAGContext> {
  const ragService = new RAGService();
  
  try {
    // 検索オプションの設定
    const searchOptions: RAGSearchOptions = {
      query: input,
      limit: 15,
      useHybridSearch: true,
      vectorWeight: 0.7,
    };

    // 色やカテゴリの抽出
    const extractedFilters = extractSearchFilters(input);
    if (Object.keys(extractedFilters).length > 0) {
      searchOptions.filters = extractedFilters;
    }

    // RAG検索実行
    const searchResult = await ragService.search(searchOptions);
    
    return {
      relevantProducts: searchResult.products,
      searchType: searchResult.searchType,
      totalResults: searchResult.totalResults,
      searchTimeMs: searchResult.searchTimeMs,
      relevanceScores: searchResult.relevanceScores,
    };
  } catch (error) {
    console.error('RAG検索エラー:', error);
    
    // フォールバック
    if (fallbackProducts && fallbackProducts.length > 0) {
      return performFallbackSearch(input, fallbackProducts);
    }
    
    throw error;
  }
}

// フォールバック検索（従来の方式）
function performFallbackSearch(input: string, products: Product[]): RAGContext {
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
        score += 12;
      } else {
        score -= 3;
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
    
  return {
    relevantProducts: finalProducts,
    searchType: 'fallback',
    totalResults: finalProducts.length,
    searchTimeMs: 0,
  };
}

// 検索フィルターの抽出
function extractSearchFilters(input: string): RAGSearchOptions['filters'] {
  const lowerInput = input.toLowerCase();
  const filters: RAGSearchOptions['filters'] = {};

  // 色フィルター
  const colorKeywords = ['黒', '白', '赤', '青', '緑', '黄', 'ピンク', 'グレー', 'ネイビー', 'ベージュ', 'ブラウン'];
  const detectedColors = colorKeywords.filter(color => lowerInput.includes(color));
  if (detectedColors.length > 0) {
    filters.colors = detectedColors;
  }

  // カテゴリフィルター
  const categoryKeywords = {
    'トップス': ['tシャツ', 'シャツ', 'ブラウス', 'カットソー'],
    'ボトムス': ['パンツ', 'スカート', 'デニム', 'ジーンズ'],
    'アウター': ['ジャケット', 'コート'],
    'ワンピース': ['ワンピース', 'ドレス'],
    'アクセサリー': ['バッグ', 'シューズ', '靴', '帽子', 'ベルト'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerInput.includes(keyword))) {
      filters.categories = [category];
      break;
    }
  }

  // 価格フィルター
  const pricePatterns = [
    { pattern: /(\d+)円以下/, type: 'max' },
    { pattern: /(\d+)円未満/, type: 'max' },
    { pattern: /(\d+)円以上/, type: 'min' },
    { pattern: /(\d+)円\s*[〜～]\s*(\d+)円/, type: 'range' },
  ];

  for (const { pattern, type } of pricePatterns) {
    const match = lowerInput.match(pattern);
    if (match) {
      if (type === 'max') {
        filters.maxPrice = parseInt(match[1]);
      } else if (type === 'min') {
        filters.minPrice = parseInt(match[1]);
      } else if (type === 'range') {
        filters.minPrice = parseInt(match[1]);
        filters.maxPrice = parseInt(match[2]);
      }
      break;
    }
  }

  // 新商品フィルター
  if (lowerInput.includes('新商品') || lowerInput.includes('新作')) {
    filters.isNew = true;
  }

  // 季節フィルター
  const seasonKeywords = {
    '春': ['春', 'スプリング'],
    '夏': ['夏', 'サマー'],
    '秋': ['秋', 'オータム'],
    '冬': ['冬', 'ウィンター'],
  };

  for (const [season, keywords] of Object.entries(seasonKeywords)) {
    if (keywords.some(keyword => lowerInput.includes(keyword))) {
      filters.season = season;
      break;
    }
  }

  return filters;
}

// RAG用システムプロンプト生成
function createRAGSystemPrompt(ragContext: RAGContext, userInput: string): string {
  // ユーザーの色指定を検出
  const lowerInput = userInput.toLowerCase();
  const colorKeywords = ['黒', '白', '赤', '青', '緑', '黄', 'ピンク', 'グレー', 'ネイビー', 'ベージュ', 'ブラウン'];
  const requestedColors = colorKeywords.filter(color => lowerInput.includes(color));
  
  const compressedProducts = ragContext.relevantProducts.map((p, index) => {
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
    
    // 関連度スコアがあれば追加
    const relevanceScore = ragContext.relevanceScores?.[p.id];
    const scoreInfo = relevanceScore ? ` [関連度:${relevanceScore.toFixed(3)}]` : '';
    
    return `${index + 1}. ${p.id}|${p.name}|${p.brand}|${p.category.join(',')}|${colorInfo}|${p.material}|${p.keywords.join(',')}|${p.target}|${p.scene}|¥${p.price}${scoreInfo}`;
  }).join('\n');
  
  const colorInstruction = requestedColors.length > 0 
    ? `\n**カラーコーディネート指針**: ユーザーは「${requestedColors.join('、')}」色を中心としたスタイリングを希望しています。以下の観点で提案してください：
    - メイン商品：指定色の商品を中心に
    - コーディネート商品：指定色と調和する色合い（補色・同系色・アクセントカラー）
    - 関連商品：トータルコーディネートを考慮した提案
    - 必ず各商品を選んだ理由とコーディネートのポイントを説明してください`
    : '';

  const searchTypeDescription = {
    'vector': 'AI意味解析検索',
    'traditional': '従来のキーワード検索',
    'hybrid': 'AI + キーワード複合検索',
    'fallback': 'フォールバック検索'
  };
  
  return `あなたは10年以上の経験を持つプロのファッションスタイリストです。最新のRAG（検索拡張生成）技術を活用して、ユーザーの要望に最適な商品を提案します。

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

**商品分類基準：**
1. **main_products**: ユーザーの要望に最も適合する商品（3-5点）
   - 指定された色・アイテム・スタイルに最も適合
   - 価格帯や年齢層もユーザーの要望に合致
   - 用途・シーンが一致

2. **sub_products**: main_productsと組み合わせできるコーディネート商品（3-8点）
   - 色の相性を重視：黒なら白・グレー・ベージュなど調和する色
   - 異なる色でも理由を明確に：「黒のトップスに白いパンツで洗練されたモノトーンコーデ」
   - スタイル統一とバランス感
   - 実際に着用シーンを想像した組み合わせ

3. **related_products**: 代替案や類似商品（2-5点）
   - 同じカテゴリで異なる色・デザイン・価格帯
   - 似たターゲット層・用途
   - 季節やトレンドを考慮した選択肢

**RAG検索結果（${searchTypeDescription[ragContext.searchType as keyof typeof searchTypeDescription]}使用）：**
${compressedProducts}

**検索統計**: 
- 検索方式: ${ragContext.searchType}
- 検索結果数: ${ragContext.totalResults}点
- 検索時間: ${ragContext.searchTimeMs}ms
- 表示商品数: ${ragContext.relevantProducts.length}点

以下のJSON形式で回答してください：
\`\`\`json
{
  "summary": "ユーザーの要望を30文字以内で要約",
  "main_products": ["最適な商品ID"],
  "sub_products": ["コーディネート商品ID"],
  "related_products": ["関連・代替商品ID"],
  "message": "各商品を選んだ理由とコーディネートアドバイスを具体的に（150文字以内）",
  "markdown_paths": [],
  "search_info": {
    "searchType": "${ragContext.searchType}",
    "totalResults": ${ragContext.totalResults},
    "searchTimeMs": ${ragContext.searchTimeMs}
  }
}
\`\`\`

提供された商品IDのみを使用し、RAG検索の精度を活用した高品質な分類を行ってください。`;
}