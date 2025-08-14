import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userInput, products } = await request.json();

    if (!userInput || !products) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // 即座に固定回答を返却
    const response = `${userInput}についてのアドバイス：とても良い選択です。スタイリングを楽しんでください。`;
    
    return new Response(response, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });

  } catch (error) {
    console.error('❌ API エラー:', error);
    return new Response('エラーが発生しました', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}