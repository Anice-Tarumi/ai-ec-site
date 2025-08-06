'use client';

import useStore from '../utils/store';

export default function Banner() {
  const { chatMessages, currentMarkdownPaths } = useStore();

  // 最新のAIメッセージを取得
  const lastAIMessage = chatMessages
    .filter(msg => msg.type === 'ai')
    .pop();

  if (!lastAIMessage) {
    return null;
  }

  return (
    <div className="mb-8 animate-fade-in-up">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 shadow-sm border border-blue-200">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🤖</span>
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              AIからの提案
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              {lastAIMessage.content}
            </p>
            
            {/* Markdownパス表示 */}
            {currentMarkdownPaths.length > 0 && (
              <div className="mt-4 p-3 bg-white/50 rounded-lg border border-blue-100">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  📄 参考資料:
                </h4>
                <div className="flex flex-wrap gap-1">
                  {currentMarkdownPaths.map((path, index) => (
                    <span 
                      key={index}
                      className="text-xs bg-white text-blue-700 px-2 py-1 rounded border border-blue-200 font-mono"
                    >
                      {path}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-500">
                {new Date(lastAIMessage.timestamp).toLocaleTimeString('ja-JP')}
              </span>
              <div className="flex space-x-2">
                <button className="text-xs bg-white text-blue-600 px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-50 transition-colors">
                  👍 参考になった
                </button>
                <button className="text-xs bg-white text-gray-600 px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
                  💬 再質問
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}