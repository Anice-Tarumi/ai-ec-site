-- PostgreSQL 初期化スクリプト

-- 商品テーブル
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    category JSONB NOT NULL,
    price INTEGER NOT NULL,
    size JSONB NOT NULL,
    color JSONB NOT NULL,
    material VARCHAR(200) NOT NULL,
    description TEXT,
    keywords JSONB NOT NULL,
    target VARCHAR(100),
    scene VARCHAR(200),
    recommend_for VARCHAR(200),
    catchcopy TEXT,
    image VARCHAR(255),
    rating DECIMAL(3,1) DEFAULT 0.0,
    reviews INTEGER DEFAULT 0,
    is_new BOOLEAN DEFAULT FALSE,
    season VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 商品検索用のインデックス
CREATE INDEX IF NOT EXISTS idx_products_category ON products USING GIN (category);
CREATE INDEX IF NOT EXISTS idx_products_color ON products USING GIN (color);
CREATE INDEX IF NOT EXISTS idx_products_keywords ON products USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_price ON products (price);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products (rating);
CREATE INDEX IF NOT EXISTS idx_products_is_new ON products (is_new);
CREATE INDEX IF NOT EXISTS idx_products_season ON products (season);

-- 全文検索用のインデックス（商品名・説明）
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING GIN (to_tsvector('japanese', name));
CREATE INDEX IF NOT EXISTS idx_products_description_search ON products USING GIN (to_tsvector('japanese', description));

-- ベクトル検索履歴テーブル（分析用）
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    vector_id VARCHAR(50),
    search_type VARCHAR(20) DEFAULT 'vector',
    results_count INTEGER DEFAULT 0,
    search_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 検索履歴インデックス
CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history (query);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history (created_at);

-- 商品カテゴリ統計ビュー
CREATE OR REPLACE VIEW product_category_stats AS
SELECT 
    category->0 as main_category,
    category->1 as sub_category,
    COUNT(*) as product_count,
    AVG(price) as avg_price,
    AVG(rating) as avg_rating
FROM products 
GROUP BY category->0, category->1
ORDER BY product_count DESC;

-- 人気商品ビュー（レビュー数とレーティング基準）
CREATE OR REPLACE VIEW popular_products AS
SELECT 
    id,
    name,
    brand,
    price,
    rating,
    reviews,
    (rating * LOG(reviews + 1)) as popularity_score
FROM products 
WHERE reviews > 0
ORDER BY popularity_score DESC;

-- 新商品ビュー
CREATE OR REPLACE VIEW new_products AS
SELECT 
    id,
    name,
    brand,
    category,
    price,
    rating,
    reviews,
    created_at
FROM products 
WHERE is_new = TRUE
ORDER BY created_at DESC;

-- updated_at トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at トリガー
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 統計情報取得関数
CREATE OR REPLACE FUNCTION get_product_stats()
RETURNS JSON AS $$
BEGIN
    RETURN json_build_object(
        'total_products', (SELECT COUNT(*) FROM products),
        'total_brands', (SELECT COUNT(DISTINCT brand) FROM products),
        'total_categories', (SELECT COUNT(DISTINCT category->0) FROM products),
        'avg_price', (SELECT ROUND(AVG(price)) FROM products),
        'new_products', (SELECT COUNT(*) FROM products WHERE is_new = TRUE),
        'price_range', json_build_object(
            'min', (SELECT MIN(price) FROM products),
            'max', (SELECT MAX(price) FROM products)
        )
    );
END;
$$ LANGUAGE plpgsql;