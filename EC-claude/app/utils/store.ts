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

  addChatMessage: (message: ChatMessage) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  setIsLoading: (loading: boolean) => set({ isLoading: loading }),

  handleAIResponse: (response: AIResponse) =>
    set((state) => {
      const { allProducts } = state;
      
      const findProductsByIds = (ids: string[]) =>
        ids.map((id) => allProducts.find((p) => p.id === id)).filter(Boolean) as Product[];

      const mainProducts = findProductsByIds(response.main_products);
      const subProducts = findProductsByIds(response.sub_products);
      const relatedProducts = findProductsByIds(response.related_products);

      // AIメッセージを追加
      const aiMessage: ChatMessage = {
        type: 'ai',
        content: response.message,
        timestamp: new Date().toISOString(),
      };

      return {
        mainProducts,
        subProducts,
        relatedProducts,
        currentSummary: response.summary,
        currentMarkdownPaths: response.markdown_paths,
        chatMessages: [...state.chatMessages, aiMessage],
      };
    }),

  getFilteredProducts: () => {
    const { allProducts } = get();
    // 最大50件まで返す
    return allProducts.slice(0, 50);
  },

  setAllProducts: (products: Product[]) => set({ allProducts: products }),
}));

export default useStore;