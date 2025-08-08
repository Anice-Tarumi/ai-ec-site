import { Product, AIResponse } from '../types';

interface StreamEvent {
  type: 'start' | 'token' | 'complete' | 'error';
  content?: string;
  message?: string;
  data?: AIResponse;
  isComplete?: boolean;
}

class AIService {
  static async sendMessageStream(
    userInput: string, 
    products: Product[], 
    onStreamUpdate: (event: StreamEvent) => void
  ): Promise<AIResponse> {
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

      // Server-Sent Eventsの場合
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('ストリームの読み取りができませんでした');

        const decoder = new TextDecoder();
        let finalResponse: AIResponse | null = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const eventData = JSON.parse(line.slice(6));
                  onStreamUpdate(eventData);

                  if (eventData.type === 'complete' && eventData.data) {
                    finalResponse = eventData.data;
                  }
                } catch (e) {
                  console.error('Failed to parse stream event:', e);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (!finalResponse) {
          throw new Error('ストリームから最終レスポンスを取得できませんでした');
        }

        return finalResponse;
      }

      // 通常のJSONレスポンス（フォールバック）
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

  // 後方互換性のため既存のメソッドも残す
  static async sendMessage(userInput: string, products: Product[]): Promise<AIResponse> {
    return new Promise((resolve, reject) => {
      this.sendMessageStream(userInput, products, () => {})
        .then(resolve)
        .catch(reject);
    });
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