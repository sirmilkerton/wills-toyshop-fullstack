import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import multer from "multer";

import { initSchema, run, get, all } from "./db.js";
import { hashPassword, verifyPassword, signToken, requireAuth } from "./auth.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "owner@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe123!";

await initSchema();

app.use(helmet({
  contentSecurityPolicy: false, // keep simple for local demo
}));
app.use(morgan("dev"));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const uploadsDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const stamp = Date.now();
    cb(null, `${stamp}_${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ---------- helpers ----------
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toPence(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

// ---------- auth ----------
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = await get("SELECT * FROM users WHERE email = ?", [String(email).toLowerCase()]);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await verifyPassword(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
  res.cookie("auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // set true behind HTTPS in real deployment
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return res.json({ ok: true });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("auth");
  return res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth(JWT_SECRET), async (req, res) => {
  return res.json({ user: req.user });
});

// ---------- products (public) ----------
app.get("/api/products", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const category = String(req.query.category || "").trim();
  const filter = String(req.query.filter || "all"); // new|bestseller|sale|all
  const sort = String(req.query.sort || "featured"); // featured|price-asc|price-desc|name-asc

  let where = "1=1";
  const params = [];

  if (q) {
    where += " AND (lower(name) LIKE ? OR lower(description) LIKE ? OR lower(category) LIKE ?)";
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (category) {
    where += " AND category = ?";
    params.push(category);
  }
  if (filter === "new") where += " AND is_new = 1";
  if (filter === "bestseller") where += " AND is_best_seller = 1";
  if (filter === "sale") where += " AND is_on_sale = 1";

  let orderBy = "stock DESC, updated_at DESC";
  if (sort === "price-asc") orderBy = "COALESCE(sale_price_pence, price_pence) ASC";
  if (sort === "price-desc") orderBy = "COALESCE(sale_price_pence, price_pence) DESC";
  if (sort === "name-asc") orderBy = "name ASC";

  const rows = await all(`SELECT * FROM products WHERE ${where} ORDER BY ${orderBy}`, params);
  return res.json({ products: rows });
});

app.get("/api/products/:slug", async (req, res) => {
  const slug = req.params.slug;
  const row = await get("SELECT * FROM products WHERE slug = ?", [slug]);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ product: row });
});

// ---------- products (admin) ----------
app.post("/api/admin/products", requireAuth(JWT_SECRET), upload.single("image"), async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name required" });

  const slug = slugify(name);
  const now = new Date().toISOString();

  const image_url = req.file ? `/uploads/${req.file.filename}` : String(body.image_url || "");
  const price_pence = toPence(body.price);
  const sale_price_pence = body.sale_price ? toPence(body.sale_price) : null;

  const is_new = body.is_new === "true" || body.is_new === true ? 1 : 0;
  const is_best_seller = body.is_best_seller === "true" || body.is_best_seller === true ? 1 : 0;
  const is_on_sale = body.is_on_sale === "true" || body.is_on_sale === true ? 1 : 0;

  try {
    await run(`
      INSERT INTO products (slug, name, description, category, price_pence, sale_price_pence, is_new, is_best_seller, is_on_sale, stock, image_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      slug,
      name,
      String(body.description || ""),
      String(body.category || "Toys"),
      price_pence,
      sale_price_pence,
      is_new,
      is_best_seller,
      is_on_sale,
      Math.max(0, parseInt(body.stock || "0", 10) || 0),
      image_url,
      now,
      now
    ]);
  } catch (e) {
    if (String(e).includes("UNIQUE") ) {
      return res.status(409).json({ error: "A product with this name/slug already exists. Rename it slightly." });
    }
    throw e;
  }

  const created = await get("SELECT * FROM products WHERE slug = ?", [slug]);
  return res.json({ product: created });
});

app.put("/api/admin/products/:id", requireAuth(JWT_SECRET), upload.single("image"), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get("SELECT * FROM products WHERE id = ?", [id]);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const body = req.body || {};
  const name = String(body.name ?? existing.name).trim();
  const slug = slugify(name);
  const now = new Date().toISOString();

  const image_url = req.file ? `/uploads/${req.file.filename}` : (String(body.image_url || existing.image_url));

  const price_pence = body.price != null ? toPence(body.price) : existing.price_pence;
  const sale_price_pence = body.sale_price === "" ? null : (body.sale_price != null ? toPence(body.sale_price) : existing.sale_price_pence);

  const is_new = body.is_new != null ? ((body.is_new === "true" || body.is_new === true) ? 1 : 0) : existing.is_new;
  const is_best_seller = body.is_best_seller != null ? ((body.is_best_seller === "true" || body.is_best_seller === true) ? 1 : 0) : existing.is_best_seller;
  const is_on_sale = body.is_on_sale != null ? ((body.is_on_sale === "true" || body.is_on_sale === true) ? 1 : 0) : existing.is_on_sale;

  await run(`
    UPDATE products
    SET slug=?, name=?, description=?, category=?, price_pence=?, sale_price_pence=?, is_new=?, is_best_seller=?, is_on_sale=?, stock=?, image_url=?, updated_at=?
    WHERE id=?
  `, [
    slug,
    name,
    String(body.description ?? existing.description),
    String(body.category ?? existing.category),
    price_pence,
    sale_price_pence,
    is_new,
    is_best_seller,
    is_on_sale,
    body.stock != null ? Math.max(0, parseInt(body.stock, 10) || 0) : existing.stock,
    image_url,
    now,
    id
  ]);

  const updated = await get("SELECT * FROM products WHERE id = ?", [id]);
  return res.json({ product: updated });
});

app.delete("/api/admin/products/:id", requireAuth(JWT_SECRET), async (req, res) => {
  const id = Number(req.params.id);
  await run("DELETE FROM products WHERE id = ?", [id]);
  return res.json({ ok: true });
});

// ---------- Admin bootstrap (seed-like) ----------
app.post("/api/admin/bootstrap", async (req, res) => {
  // Create admin user if none exists.
  const existing = await get("SELECT * FROM users WHERE email = ?", [ADMIN_EMAIL.toLowerCase()]);
  if (existing) return res.json({ ok: true, already: true });

  const hash = await hashPassword(ADMIN_PASSWORD);
  const now = new Date().toISOString();
  await run("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)", [
    ADMIN_EMAIL.toLowerCase(),
    hash,
    "admin",
    now
  ]);
  return res.json({ ok: true, created: true });
});

// ---------- static frontend ----------
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/admin", (req, res) => res.sendFile(path.join(process.cwd(), "public", "admin.html")));
app.get("/shop", (req, res) => res.sendFile(path.join(process.cwd(), "public", "shop.html")));
app.get("/cart", (req, res) => res.sendFile(path.join(process.cwd(), "public", "cart.html")));
app.get("/product", (req, res) => res.sendFile(path.join(process.cwd(), "public", "product.html")));

app.get("*", (req, res) => res.sendFile(path.join(process.cwd(), "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
