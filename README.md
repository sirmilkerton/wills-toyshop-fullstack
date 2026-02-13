# Will's Toy Shop — Full‑stack Demo (Modern Minimal)

This is a full‑stack ecommerce demo you can show a store owner:
- Product catalogue with search + filters
- Product detail pages
- Cart drawer + cart page
- Admin login + product management (add/edit/delete)
- Image upload (stored on disk)
- SQLite database (simple, portable)

## 1) Install
```bash
npm install
cp .env.example .env
```

Edit `.env` and set a strong `JWT_SECRET`.

## 2) Seed admin + sample products
```bash
npm run seed
```

## 3) Run
```bash
npm run dev
```

Open:
- Store: http://localhost:3000
- Admin: http://localhost:3000/admin

Login with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

## Notes
- This is a demo backend built with Express + SQLite.
- For a real launch you'd likely move to Postgres and add payments (Stripe).
"# wills-toyshop-fullstack" 
"# wills-toyshop-fullstack" 
"# wills-toyshop-fullstack" 
"# wills-toyshop-fullstack" 
