import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

export const runtime = 'nodejs';
export const maxDuration = 25; // 25秒以内に処理完了

export async function POST(request: NextRequest) {
  try {
    const { userInput, products } = await request.json();

    if (!userInput || !products) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // 簡潔なプロンプト
    const prompt = `ファッションアドバイザーとして「${userInput}」について100文字程度で具体的なアドバイスをしてください。`;

    // Gemini APIを使って一括生成（ストリーミングなし）
    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      prompt: prompt,
      temperature: 0.7,
      maxTokens: 200,
    });

    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from AI');
    }

    return new Response(text.trim(), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    
    // Gemini APIエラーの場合のフォールバック
    if (error?.message?.includes('API')) {
      return new Response('申し訳ございません。一時的にサービスが利用できません。しばらく経ってからお試しください。', { 
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
    
    return new Response('エラーが発生しました', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}