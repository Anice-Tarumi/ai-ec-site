import { create } from 'zustand';
import { Product, ChatMessage, AIResponse, StoreState } from '../types';

const useStore = create<StoreState>((set, get) => ({
  allProducts: [],
  mainProducts: [],
  subProducts: [],
  relatedProducts: [],
  chatMessages: [],
  isLoading: false,
  currentSummary: '',
  currentMarkdownPaths: [],
  streamingMessage: '',
  isStreaming: false,
  vectorSearch: null,

  addChatMessage: (message: ChatMessage) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  setIsLoading: (loading: boolean) => set({ isLoading: loading }),

  handleAIResponse: async (response: AIResponse) => {
    const allProductIds = [
      ...response.main_products,
      ...response.sub_products,
      ...response.related_products
    ];

    try {
      console.log('📦 Fetching product details for:', allProductIds);
      
      const productResponse = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: allProductIds
        })
      });

      if (!productResponse.ok) {
        throw new Error(`Product API failed: ${productResponse.status}`);
      }

      const { products } = await productResponse.json();
      console.log('✅ Product details fetched:', products.length);

      // 商品IDで商品を検索する関数
      const findProductsByIds = (ids: string[]) =>
        ids.map(id => products.find((p: Product) => p.id === id)).filter(Boolean) as Product[];

      const mainProducts = findProductsByIds(response.main_products);
      const subProducts = findProductsByIds(response.sub_products);
      const relatedProducts = findProductsByIds(response.related_products);

      set({
        mainProducts,
        subProducts,
        relatedProducts,
        currentSummary: response.summary,
        currentMarkdownPaths: response.markdown_paths,
      });

    } catch (error) {
      console.error('❌ Failed to fetch product details:', error);
      // エラー時は空の配列を設定
      set({
        mainProducts: [],
        subProducts: [],
        relatedProducts: [],
        currentSummary: response.summary,
        currentMarkdownPaths: response.markdown_paths,
      });
    }
  },

  getFilteredProducts: () => {
    // RAGシステムに移行したため、静的な商品フィルタリングは不要
    // 検索結果は動的にAPIから取得される
    return [];
  },

  setAllProducts: (products: Product[]) => {
    // RAGシステムに移行したため、この関数は使用されない
    console.warn('setAllProducts is deprecated. Use RAG search instead.');
  },

  setStreamingMessage: (message: string) => set({ streamingMessage: message }),

  setIsStreaming: (streaming: boolean) => set({ isStreaming: streaming }),

  setVectorSearch: (vectorSearch: any) => set({ vectorSearch }),
}));

export default useStore;