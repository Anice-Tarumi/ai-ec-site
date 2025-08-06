'use client';

import useStore from '../utils/store';

export default function AccessoryList() {
  const { subProducts } = useStore();

  if (subProducts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {subProducts.map((product, index) => (
        <div 
          key={product.id} 
          className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 border border-gray-100 animate-fade-in-up"
          style={{ animationDelay: `${index * 200}ms` }}
        >
          <div className="flex">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const svg = encodeURIComponent(`<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f3f4f6;stop-opacity:1" /><stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" /></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><text x="50%" y="50%" font-family="Arial" font-size="10" fill="#6b7280" text-anchor="middle" dominant-baseline="middle">${product.name.slice(0, 8)}...</text></svg>`);
                  target.src = `data:image/svg+xml,${svg}`;
                }}
              />
            </div>
            
            <div className="flex-1 p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900 text-sm leading-tight">
                  {product.name}
                </h4>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                  コーディネート
                </span>
              </div>
              
              <p className="text-xs text-gray-600 mb-2">{product.category}</p>
              
              <div className="flex flex-wrap gap-1 mb-2">
                {product.color.slice(0, 2).map((color, colorIndex) => (
                  <span 
                    key={colorIndex} 
                    className="text-xs bg-gray-100 px-1 py-0.5 rounded text-gray-600"
                  >
                    {color}
                  </span>
                ))}
                {product.color.length > 2 && (
                  <span className="text-xs text-gray-400">
                    +{product.color.length - 2}
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-center">
                <p className="text-lg font-bold text-purple-600">
                  ¥{product.price.toLocaleString()}
                </p>
                <button className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 transition-colors text-xs font-medium">
                  追加
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}