import { Client as PgClient } from "pg";
import { ChromaClient } from "chromadb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "../../.env.local") });

// Gemini APIキー
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// PostgreSQL接続設定
const pgClient = new PgClient({
  host: "localhost",
  port: 5432,
  user: "postgres",        // あなたのユーザー名
  password: "taru3822",   // あなたのパスワード
  database: "mydb"
});

// ChromaDBクライアント
const chroma = new ChromaClient({ path: "http://localhost:8000" });

async function main() {
  await pgClient.connect();

  // 既存コレクション取得 or 新規作成（embeddingFunctionを明示的に無効化）
  let collection;
  try {
    collection = await chroma.getCollection({ name: "products" });
  } catch {
    collection = await chroma.createCollection({
      name: "products",
      embeddingFunction: null // ← これが重要
    });
  }

  const res = await pgClient.query("SELECT * FROM products");
  console.log(`🔍 ${res.rows.length} 件のデータを取得`);

  for (const product of res.rows) {
    const searchText = `
      商品名: ${product.name}
      ブランド: ${product.brand}
      カテゴリ: ${product.category}
      説明: ${product.description}
      キーワード: ${product.keywords}
    `;

    // GeminiでEmbedding作成
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    const embeddingResult = await model.embedContent(searchText);
    const vector = embeddingResult.embedding.values;

    await collection.add({
      ids: [product.id],
      embeddings: [vector],
      metadatas: [{
        name: product.name,
        brand: product.brand,
        price: product.price
      }],
      documents: [searchText]
    });

    console.log(`✅ ${product.id} 登録完了`);
  }

  await pgClient.end();
}

main().catch(err => console.error("❌ エラー:", err));
