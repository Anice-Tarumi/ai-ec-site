export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string[];
  price: number;
  size: string[];
  color: string[];
  material: string;
  description: string;
  keywords: string[];
  target: string;
  scene: string;
  recommend_for: string;
  catchcopy: string;
  image: string;
  rating: number;
  reviews: number;
  is_new: boolean;
  season: string;
}

export interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface AIResponse {
  summary: string;
  main_products: string[];
  sub_products: string[];
  related_products: string[];
  message: string;
  markdown_paths: string[];
}

export interface StoreState {
  allProducts: Product[];
  mainProducts: Product[];
  subProducts: Product[];
  relatedProducts: Product[];
  chatMessages: ChatMessage[];
  isLoading: boolean;
  currentSummary: string;
  currentMarkdownPaths: string[];
  addChatMessage: (message: ChatMessage) => void;
  setIsLoading: (loading: boolean) => void;
  handleAIResponse: (response: AIResponse) => void;
  getFilteredProducts: () => Product[];
  setAllProducts: (products: Product[]) => void;
}