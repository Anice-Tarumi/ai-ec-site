import { NextRequest } from 'next/server';
import DatabaseClient from '../../utils/DatabaseClient';

export const runtime = 'nodejs';
export const maxDuration = 25;

export async function POST(request: NextRequest) {
  try {
    const { productIds } = await request.json();

    if (!productIds || !Array.isArray(productIds)) {
      return new Response(
        JSON.stringify({ error: 'productIds array is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('📦 Product details API called for IDs:', productIds);

    const dbClient = new DatabaseClient();
    const products = await dbClient.getProductsByIds(productIds);

    console.log('✅ Retrieved product details:', {
      requested: productIds.length,
      found: products.length
    });

    return new Response(
      JSON.stringify({ products }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Products API Error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Products API Error',
        message: error instanceof Error ? error.message : '商品詳細の取得でエラーが発生しました。'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}