'use client';

import { useState, useRef } from 'react';
// import { useChat } from '@ai-sdk/react';
import useStore from '../utils/store';

export default function ChatBox() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const streamingMessageRef = useRef('');
  const { 
    addChatMessage, 
    handleAIResponse, 
    getFilteredProducts,
    setStreamingMessage,
    setIsStreaming
  } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingMessage('');
    streamingMessageRef.current = '';

    // ユーザーメッセージをストアに追加
    addChatMessage({
      type: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    try {
      // 商品データを取得してAPIに送信
      const products = getFilteredProducts();
      console.log('📡 API呼び出し開始:', userMessage);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput: userMessage,
          products: products
        })
      });

      if (!response.ok) {
        console.error('❌ API応答エラー:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}`);
      }
      
      console.log('✅ API応答受信:', response.status);

      // 一括回答の処理
      console.log('📖 回答取得開始');
      const fullResponse = await response.text();
      console.log('✅ AI回答取得完了:', fullResponse.substring(0, 100));

      // 回答完了後、フィルターAPIを呼び出し
      setIsStreaming(false);
      
      // チャット履歴に回答を保存（空でない場合のみ）
      if (fullResponse.trim()) {
        addChatMessage({
          type: 'ai',
          content: fullResponse,
          timestamp: new Date().toISOString()
        });
      }

      // 商品フィルタリング用の別APIを呼び出し
      try {
        console.log('🔍 商品フィルターAPI呼び出し開始');
        const filterResponse = await fetch('/api/filter', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userInput: userMessage,
              products: products
            })
          });

          if (filterResponse.ok) {
            const filterResult = await filterResponse.text();
            console.log('📊 フィルター結果:', filterResult);
              
            // JSONを解析して商品フィルタリング実行
            const jsonMatch = filterResult.match(/```json\s*([\s\S]*?)\s*```/) || filterResult.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonStr = jsonMatch[1] || jsonMatch[0];
              const aiResponse = JSON.parse(jsonStr);
              console.log('✅ フィルターJSON解析成功:', aiResponse);
              handleAIResponse(aiResponse);
            } else {
              console.log('⚠️ フィルターAPIでJSON未検出:', filterResult);
            }
          } else {
            console.error('❌ フィルターAPI呼び出し失敗:', filterResponse.status, filterResponse.statusText);
          }
      } catch (filterError) {
        console.error('❌ フィルターAPI エラー:', filterError);
      }

      // ローディング状態を解除
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingMessage('');
      streamingMessageRef.current = '';
      
      let errorMessage = 'エラーが発生しました。';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'サーバーとの通信に失敗しました。';
        } else if (error.message.includes('Gemini API Error')) {
          errorMessage = 'Gemini API エラー: 設定を確認してください。';
        }
      }
      
      addChatMessage({
        type: 'ai',
        content: `❌ ${errorMessage}`,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const quickSuggestions = [
    '赤い服が欲しいです',
    'ビジネス用の服',
    'カジュアルな服',
    '春の服装',
    '夏の服装',
    'デート用の服',
    '黒い服を探している'
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t shadow-2xl z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="どんな服をお探しですか？例：「赤い服が欲しいです」「ビジネス用の服を探しています」"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all duration-200 bg-white/90"
              rows={2}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                <span className="loading-dots">送信中</span>
              </div>
            ) : (
              <span className="flex items-center">
                <span>送信</span>
                <span className="ml-1">🚀</span>
              </span>
            )}
          </button>
        </form>
        
        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-sm text-gray-500 font-medium">💡 提案:</span>
          {quickSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInput(suggestion)}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-full hover:from-blue-100 hover:to-blue-200 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}