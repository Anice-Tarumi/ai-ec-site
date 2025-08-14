'use client';

import useStore from '../utils/store';

export default function RelatedProductsList() {
  const { relatedProducts } = useStore();

  if (relatedProducts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {relatedProducts.map((product, index) => (
        <div 
          key={product.id} 
          className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 border border-gray-100 animate-fade-in-up hover:border-green-200"
          style={{ animationDelay: `${index * 200}ms` }}
        >
          <div className="flex">
            <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-green-200 flex-shrink-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs text-green-700 font-medium">関連</p>
                <p className="text-xs text-green-600">{product.name.slice(0, 4)}</p>
              </div>
            </div>
            
            <div className="flex-1 p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900 text-sm leading-tight">
                  {product.name}
                </h4>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                  関連商品
                </span>
              </div>
              
              <p className="text-xs text-gray-600 mb-2">{product.category.join(', ')}</p>
              
              <div className="flex flex-wrap gap-1 mb-2">
                {product.keywords.slice(0, 2).map((keyword, keywordIndex) => (
                  <span 
                    key={keywordIndex} 
                    className="text-xs bg-green-50 text-green-600 px-1 py-0.5 rounded border border-green-200"
                  >
                    #{keyword}
                  </span>
                ))}
                {product.keywords.length > 2 && (
                  <span className="text-xs text-gray-400">
                    +{product.keywords.length - 2}
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-center">
                <p className="text-lg font-bold text-green-600">
                  ¥{product.price.toLocaleString()}
                </p>
                <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors text-xs font-medium">
                  詳細
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}