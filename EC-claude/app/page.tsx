'use client';

import { useEffect, useState } from 'react';
import useStore from './utils/store';
import ChatBox from './components/ChatBox';
import ProductList from './components/ProductList';
import AccessoryList from './components/AccessoryList';
import Banner from './components/Banner';
import RelatedProductsList from './components/RelatedProductsList';
import VectorSearch from './utils/VectorSearch';
import { Product } from './types';

export default function Home() {
  const { 
    allProducts, 
    mainProducts, 
    subProducts, 
    relatedProducts,
    isLoading, 
    streamingMessage,
    isStreaming,
    chatMessages,
    setAllProducts,
    setVectorSearch
  } = useStore();
  
  const [showResults, setShowResults] = useState(false);
  const [vectorSearch] = useState(() => new VectorSearch());

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/data/products.json');
        const products: Product[] = await response.json();
        setAllProducts(products);
        
        // RAG用にベクトル化（バックグラウンドで実行）
        console.log('🔍 RAG検索の初期化中...');
        setVectorSearch(vectorSearch);
        vectorSearch.indexProducts(products).then(() => {
          console.log('✅ RAG検索の準備完了');
        });
      } catch (error) {
        console.error('商品データの読み込みに失敗しました:', error);
      }
    };

    loadProducts();
  }, [setAllProducts, setVectorSearch, vectorSearch]);

  useEffect(() => {
    if (mainProducts.length > 0 || subProducts.length > 0) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [mainProducts, subProducts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <header className="bg-white shadow-sm border-b backdrop-blur-sm bg-white/90 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI Fashion Store
          </h1>
          <p className="text-gray-600 mt-2">AIがあなたの好みに合わせて商品をおすすめします</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 pb-32">

        {/* <Banner /> */}
        {isLoading && (
          <div className="flex flex-col justify-center items-center py-16 animate-pulse">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
              <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-4 border-blue-400 opacity-20"></div>
            </div>
            <div className="mt-6 text-center">
              <p className="text-lg font-medium text-gray-700 animate-bounce">
                🤖 AIが考え中...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                あなたにぴったりの商品を探しています
              </p>
            </div>
          </div>
        )}

        {/* チャット履歴表示 */}
        {(chatMessages.length > 0 || (isStreaming && streamingMessage)) && (
          <div className="mb-8 space-y-4">
            {/* 過去のチャット履歴 */}
            {chatMessages.map((message, index) => (
              <div key={index} className="animate-fade-in-up">
                <div className={`rounded-xl p-4 shadow-sm border ${
                  message.type === 'user' 
                    ? 'bg-white border-gray-200 ml-12' 
                    : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 mr-12'
                }`}>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user' 
                          ? 'bg-gray-100 text-gray-600' 
                          : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      }`}>
                        {message.type === 'user' ? '👤' : '🤖'}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </p>
                      <span className="text-xs text-gray-500 mt-2 block">
                        {new Date(message.timestamp).toLocaleTimeString('ja-JP')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* ストリーミング中のAI回答表示 */}
            {isStreaming && streamingMessage && (
              <div className="animate-fade-in-up">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 shadow-sm border border-blue-200 mr-12">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white">
                        🤖
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {streamingMessage}
                        <span className="animate-pulse text-blue-500">|</span>
                      </p>
                      <span className="text-xs text-gray-500 mt-2 block">
                        回答中...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {showResults && !isLoading && (
          <div className="animate-fade-in-up space-y-8">
            {mainProducts.length > 0 && (
              <div className="animate-slide-in-left">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <span className="mr-3">⭐</span>
                  おすすめ商品
                </h2>
                <ProductList />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {subProducts.length > 0 && (
                <div className="animate-slide-in-right">
                  <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3">🎯</span>
                    コーディネート提案
                  </h2>
                  <AccessoryList />
                </div>
              )}

              {relatedProducts.length > 0 && (
                <div className="animate-slide-in-left">
                  <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3">💡</span>
                    関連商品
                  </h2>
                  <RelatedProductsList />
                </div>
              )}
            </div>
          </div>
        )}

        {!showResults && !isLoading && (
          <div className="mb-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">全ての商品</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {allProducts.slice(0, 12).map((product, index) => (
                <div 
                  key={product.id} 
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-105 animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 h-48 flex items-center justify-center">
                    <div className="text-center">
                      <h4 className="font-bold text-gray-700 text-lg">{product.name}</h4>
                      <p className="text-gray-500 text-sm mt-1">{product.brand}</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{product.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{product.category.join(', ')}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {product.color.map((color, colorIndex) => (
                        <span key={colorIndex} className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {color}
                        </span>
                      ))}
                    </div>
                    <p className="text-lg font-bold text-blue-600">¥{product.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <ChatBox />
    </div>
  );
}