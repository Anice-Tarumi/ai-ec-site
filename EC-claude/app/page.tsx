'use client';

import { useEffect, useState } from 'react';
import useStore from './utils/store';
import ChatBox from './components/ChatBox';
import ProductList from './components/ProductList';
import AccessoryList from './components/AccessoryList';
import Banner from './components/Banner';
import RelatedProductsList from './components/RelatedProductsList';
import { Product } from './types';

export default function Home() {
  const { 
    allProducts, 
    mainProducts, 
    subProducts, 
    relatedProducts,
    isLoading, 
    currentSummary,
    setAllProducts 
  } = useStore();
  
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    // 商品データを読み込み
    const loadProducts = async () => {
      try {
        const response = await fetch('/data/products.json');
        const products: Product[] = await response.json();
        setAllProducts(products);
      } catch (error) {
        console.error('商品データの読み込みに失敗しました:', error);
      }
    };

    loadProducts();
  }, [setAllProducts]);

  useEffect(() => {
    // AIの結果が返ってきたときにアニメーション表示
    if (mainProducts.length > 0 || subProducts.length > 0) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [mainProducts, subProducts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b backdrop-blur-sm bg-white/90 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI Fashion Store
          </h1>
          <p className="text-gray-600 mt-2">AIがあなたの好みに合わせて商品をおすすめします</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 pb-32">

        {/* AI Summary Banner */}
        {currentSummary && showResults && (
          <div className="mb-8 animate-fade-in-up">
            <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-6 shadow-sm border border-blue-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                📝 要望の要約
              </h2>
              <p className="text-gray-700">{currentSummary}</p>
            </div>
          </div>
        )}

        {/* AI Message Banner */}
        <Banner />

        {/* Loading State with Enhanced Animation */}
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

        {/* Products Display with Animation */}
        {showResults && !isLoading && (
          <div className="animate-fade-in-up space-y-8">
            {/* Main Products */}
            {mainProducts.length > 0 && (
              <div className="animate-slide-in-left">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <span className="mr-3">⭐</span>
                  おすすめ商品
                </h2>
                <ProductList />
              </div>
            )}

            {/* Sub Products and Related Products Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Sub Products */}
              {subProducts.length > 0 && (
                <div className="animate-slide-in-right">
                  <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3">🎯</span>
                    コーディネート提案
                  </h2>
                  <AccessoryList />
                </div>
              )}

              {/* Related Products */}
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

        {/* Default All Products Display (when no AI selection) */}
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
                  <div className="aspect-w-1 aspect-h-1 bg-gray-200">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const svg = encodeURIComponent(`<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#6b7280" text-anchor="middle" dominant-baseline="middle">${product.name}</text></svg>`);
                        target.src = `data:image/svg+xml,${svg}`;
                      }}
                    />
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

      {/* Fixed Chat Box at Bottom */}
      <ChatBox />
    </div>
  );
}