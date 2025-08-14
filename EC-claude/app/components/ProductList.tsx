'use client';

import useStore from '../utils/store';

export default function ProductList() {
  const { mainProducts } = useStore();

  if (mainProducts.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {mainProducts.map((product, index) => (
        <div 
          key={product.id} 
          className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-105 animate-scale-in border border-gray-100"
          style={{ animationDelay: `${index * 150}ms` }}
        >
          <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg inline-block mb-2">
                おすすめ
              </div>
              <h4 className="font-bold text-gray-700 text-lg">{product.name}</h4>
              <p className="text-gray-500 text-sm mt-1">{product.brand}</p>
            </div>
          </div>
          
          <div className="p-5">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-gray-900 text-lg leading-tight">
                {product.name}
              </h3>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                {product.category}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-1 mb-3">
              {product.color.map((color, colorIndex) => (
                <span 
                  key={colorIndex} 
                  className="text-xs bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 px-2 py-1 rounded-full border border-blue-200"
                >
                  {color}
                </span>
              ))}
            </div>
            
            <div className="flex flex-wrap gap-1 mb-4">
              {product.keywords.map((keyword, keywordIndex) => (
                <span 
                  key={keywordIndex} 
                  className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded border"
                >
                  #{keyword}
                </span>
              ))}
            </div>
            
            <div className="flex justify-between items-center">
              <p className="text-2xl font-bold text-blue-600">
                ¥{product.price.toLocaleString()}
              </p>
              <button className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 text-sm font-medium">
                詳細を見る
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}