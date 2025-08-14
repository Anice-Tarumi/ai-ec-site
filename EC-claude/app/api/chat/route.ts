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

    // デバッグ: 環境変数確認
    console.log('Environment check:', {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasGoogleKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      geminiKeyStart: process.env.GEMINI_API_KEY?.substring(0, 8) || 'none',
      nodeEnv: process.env.NODE_ENV
    });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    
    if (!apiKey) {
      console.error('No API key found');
      return new Response('API key not configured', { 
        status: 500, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    const prompt = `ファッションアドバイザーとして「${userInput}」について100文字程度で具体的なアドバイスをしてください。`;

    console.log('Calling Gemini API...');
    const { text } = await generateText({
      model: google('gemini-1.5-flash', { apiKey }),
      prompt: prompt,
      temperature: 0.7,
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
    console.error('API Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`エラーが発生しました: ${errorMessage}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}