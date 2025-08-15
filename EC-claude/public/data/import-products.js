import fs from "fs";
import pkg from "pg";
const { Client } = pkg;

// PostgreSQL 接続設定（自分の環境に合わせて変更）
const client = new Client({
  host: "localhost",     // 通常は localhost
  port: 5432,             // デフォルトポート
  user: "postgres",       // あなたのユーザー名
  password: "taru3822", // あなたのパスワード
  database: "mydb"        // 作成したDB名
});

// JSONファイル読み込み
const products = JSON.parse(fs.readFileSync("./products-large.json", "utf8"));

async function main() {
  try {
    await client.connect();

    for (const product of products) {
      await client.query(
        `INSERT INTO products (
          id, name, brand, category, price, size, color, material, description,
          keywords, target, scene, recommend_for, catchcopy, image, rating, reviews, is_new, season
        ) VALUES (
          $1, $2, $3, $4::jsonb, $5, $6::jsonb, $7::jsonb, $8, $9,
          $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18, $19
        ) ON CONFLICT (id) DO NOTHING`,
        [
          product.id,
          product.name,
          product.brand,
          JSON.stringify(product.category),
          product.price,
          JSON.stringify(product.size),
          JSON.stringify(product.color),
          product.material,
          product.description,
          JSON.stringify(product.keywords),
          product.target,
          product.scene,
          product.recommend_for,
          product.catchcopy,
          product.image,
          product.rating,
          product.reviews,
          product.is_new,
          product.season
        ]
      );
    }

    console.log("✅ データ登録完了！");
  } catch (err) {
    console.error("❌ エラー:", err);
  } finally {
    await client.end();
  }
}

main();
