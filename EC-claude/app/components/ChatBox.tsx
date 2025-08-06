'use client';

import { useState } from 'react';
import useStore from '../utils/store';
import AIService from '../utils/AIService';

export default function ChatBox() {
  const [inputValue, setInputValue] = useState('');
  const { 
    addChatMessage, 
    handleAIResponse, 
    setIsLoading, 
    isLoading, 
    getFilteredProducts 
  } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // ユーザーメッセージを追加
    addChatMessage({
      type: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    // ローディング開始
    setIsLoading(true);

    try {
      // 商品データを取得（50件まで）
      const products = getFilteredProducts();
      
      // AI サービスを呼び出し
      const response = await AIService.sendMessage(userMessage, products);
      
      
      // レスポンスを処理
      handleAIResponse(response);
    } catch (error) {
      
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
    } finally {
      setIsLoading(false);
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
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="どんな服をお探しですか？例：「赤い服が欲しいです」「ビジネス用の服を探しています」"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all duration-200 bg-white/90"
              rows={2}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
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
              onClick={() => setInputValue(suggestion)}
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