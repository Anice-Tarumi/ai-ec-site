import { Product, AIResponse } from '../types';

class AIService {
  static async sendMessage(userInput: string, products: Product[]): Promise<AIResponse> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput,
          products
        })
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // JSON解析に失敗した場合はHTTPステータスを使用
        }
        throw new Error(`Gemini API Error: ${errorMessage}`);
      }

      const data = await response.json();
      
      // エラーレスポンスかチェック
      if (data.error) {
        throw new Error(`Gemini API Error: ${data.message || 'Unknown error'}\nDetails: ${data.details || ''}\nError Type: ${data.errorType || ''}`);
      }
      
      return data as AIResponse;
    } catch (error) {
      throw error;
    }
  }

  static validateResponse(response: AIResponse): AIResponse {
    
    if (!response) {
      throw new Error('レスポンスが空です');
    }

    // デフォルト値を設定
    const validatedResponse: AIResponse = {
      summary: response.summary || 'お探しの商品について',
      main_products: Array.isArray(response.main_products) ? response.main_products : [],
      sub_products: Array.isArray(response.sub_products) ? response.sub_products : [],
      related_products: Array.isArray(response.related_products) ? response.related_products : [],
      message: response.message || 'おすすめの商品をご提案いたします！',
      markdown_paths: Array.isArray(response.markdown_paths) ? response.markdown_paths : []
    };

    return validatedResponse;
  }
}

export default AIService;