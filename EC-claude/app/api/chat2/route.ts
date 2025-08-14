import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

export const runtime = 'nodejs';
export const maxDuration = 25;

export async function POST(request: NextRequest) {
  try {
    const { userInput, products } = await request.json();

    if (!userInput || !products) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    console.log('🚀 NEW ENDPOINT - Processing:', userInput);

    const prompt = `ファッションアドバイザーとして「${userInput}」について100文字程度で具体的なアドバイスをしてください。`;

    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      prompt: prompt,
      temperature: 0.7,
      maxTokens: 200,
    });

    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from AI');
    }

    console.log('✅ Gemini response:', text.substring(0, 50));
    
    return new Response(text.trim(), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    
    return new Response('エラーが発生しました: ' + (error?.message || 'Unknown error'), { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}