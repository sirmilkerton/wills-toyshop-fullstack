import "dotenv/config";
import { initSchema, run, get, all } from "../db.js";
import { hashPassword } from "../auth.js";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "owner@example.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe123!";

function slugify(name) {
  return name.toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function toPence(n) { return Math.round(Number(n) * 100); }

await initSchema();

const user = await get("SELECT * FROM users WHERE email = ?", [ADMIN_EMAIL]);
if (!user) {
  const hash = await hashPassword(ADMIN_PASSWORD);
  await run("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)", [
    ADMIN_EMAIL, hash, new Date().toISOString()
  ]);
  console.log("Admin user created:", ADMIN_EMAIL);
} else {
  console.log("Admin user exists:", ADMIN_EMAIL);
}

const countRow = await get("SELECT COUNT(*) AS c FROM products");
if (countRow.c === 0) {
  const now = new Date().toISOString();
  const products = [
    {
      name: "LEGO Bricks Mix (Placeholder)",
      description: "Classic colourful bricks for creative builds.",
      category: "Lego",
      price: 14.99,
      sale_price: null,
      is_new: 1, is_best_seller: 1, is_on_sale: 0,
      stock: 18,
      image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Lego_bricks.jpg/640px-Lego_bricks.jpg"
    },
    {
      name: "Teddy Bear Plush (Placeholder)",
      description: "Soft plush teddy — gift-ready.",
      category: "Teddies",
      price: 12.99,
      sale_price: null,
      is_new: 1, is_best_seller: 0, is_on_sale: 0,
      stock: 14,
      image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/TeddyBears.jpg/640px-TeddyBears.jpg"
    },
    {
      name: "Jigsaw Puzzle 1000pc (Sale Placeholder)",
      description: "A relaxing 1000-piece challenge.",
      category: "Puzzles",
      price: 19.99,
      sale_price: 14.99,
      is_new: 0, is_best_seller: 1, is_on_sale: 1,
      stock: 6,
      image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Jigsaw_puzzle_01_by_Scott_Cartwright.jpg/640px-Jigsaw_puzzle_01_by_Scott_Cartwright.jpg"
    }
  ];

  for (const p of products) {
    await run(`
      INSERT INTO products (slug, name, description, category, price_pence, sale_price_pence, is_new, is_best_seller, is_on_sale, stock, image_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      slugify(p.name), p.name, p.description, p.category,
      toPence(p.price), p.sale_price ? toPence(p.sale_price) : null,
      p.is_new, p.is_best_seller, p.is_on_sale,
      p.stock, p.image_url, now, now
    ]);
  }
  console.log("Seeded products.");
} else {
  console.log("Products already exist, skipping seed.");
}
