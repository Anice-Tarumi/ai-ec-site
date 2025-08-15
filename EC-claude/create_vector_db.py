#!/usr/bin/env python3
"""
商品データをChromaDBにベクトル化して保存するスクリプト
"""

import chromadb
import json
import os
from typing import List, Dict

def load_product_data() -> List[Dict]:
    """商品データを読み込む"""
    with open('./public/data/products.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def create_product_text(product: Dict) -> str:
    """商品データをテキスト形式に変換"""
    # 配列データを安全に処理
    category = ', '.join(product.get('category', []))
    size = ', '.join(product.get('size', []))
    color = ', '.join(product.get('color', []))
    keywords = ', '.join(product.get('keywords', []))
    
    text = f"""商品名: {product.get('name', '')}
ブランド: {product.get('brand', '')}
カテゴリ: {category}
価格: {product.get('price', 0)}円
サイズ: {size}
カラー: {color}
素材: {product.get('material', '')}
説明: {product.get('description', '')}
キーワード: {keywords}
ターゲット: {product.get('target', '')}
シーン: {product.get('scene', '')}
おすすめ: {product.get('recommend_for', '')}
キャッチコピー: {product.get('catchcopy', '')}
季節: {product.get('season', '')}"""
    
    return text

def create_metadata(product: Dict) -> Dict:
    """メタデータを作成"""
    # 配列データを文字列に変換（ChromaDBは配列をサポートしない）
    category = ', '.join(product.get('category', []))
    size = ', '.join(product.get('size', []))
    color = ', '.join(product.get('color', []))
    keywords = ', '.join(product.get('keywords', []))
    
    return {
        'id': product.get('id', ''),
        'name': product.get('name', ''),
        'brand': product.get('brand', ''),
        'category': category,
        'price': product.get('price', 0),
        'size': size,
        'color': color,
        'material': product.get('material', ''),
        'target': product.get('target', ''),
        'scene': product.get('scene', ''),
        'rating': product.get('rating', 0.0),
        'reviews': product.get('reviews', 0),
        'is_new': product.get('is_new', False),
        'season': product.get('season', ''),
        'keywords': keywords
    }

def main():
    """メイン処理"""
    print("🔍 商品データ読み込み中...")
    products = load_product_data()
    print(f"📦 {len(products)}件の商品データを読み込みました")
    
    print("🚀 ChromaDBクライアント初期化中...")
    # ChromaDBクライアントを初期化
    chroma_client = chromadb.Client()
    
    # コレクションを作成（既に存在する場合は削除して再作成）
    try:
        chroma_client.delete_collection(name="fashion_products")
        print("🗑️ 既存のコレクションを削除しました")
    except:
        pass
    
    collection = chroma_client.create_collection(
        name="fashion_products",
        metadata={"description": "ファッション商品のベクトルデータベース"}
    )
    print("✅ ChromaDBコレクション作成完了")
    
    print("📝 商品データをベクトル化中...")
    # 商品データをテキスト化してベクトル化
    documents = []
    metadatas = []
    ids = []
    
    for product in products:
        # テキスト形式に変換
        text = create_product_text(product)
        documents.append(text)
        
        # メタデータを作成
        metadata = create_metadata(product)
        metadatas.append(metadata)
        
        # IDを追加
        ids.append(product.get('id', ''))
    
    # ChromaDBにデータを追加（自動でベクトル化される）
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    
    print(f"✅ {len(documents)}件の商品データをベクトル化してChromaDBに保存しました")
    print("🎉 ベクトルデータベース構築完了！")
    
    # 動作確認：簡単な検索テスト
    print("\n🔎 動作確認：検索テスト")
    results = collection.query(
        query_texts=["赤い服"],
        n_results=3
    )
    
    print("検索結果:")
    for i, (id, doc, metadata) in enumerate(zip(results['ids'][0], results['documents'][0], results['metadatas'][0])):
        print(f"{i+1}. {metadata['name']} (ID: {id}) - {metadata['brand']}")
    
    print("\n📊 データベース統計:")
    print(f"- 総商品数: {collection.count()}")
    print(f"- コレクション名: {collection.name}")

if __name__ == "__main__":
    main()