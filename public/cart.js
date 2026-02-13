const $ = (sel) => document.querySelector(sel);

function moneyPence(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return "£0.00";
  return `£${(n/100).toFixed(2)}`;
}

function getCart() {
  try { return JSON.parse(localStorage.getItem("cart") || "{}"); } catch { return {}; }
}
function setCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateBadge();
}
function updateBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const cart = getCart();
  const total = Object.values(cart).reduce((a,b)=>a+(Number(b)||0),0);
  el.textContent = String(total);
}
updateBadge();

async function api(path, opts={}) {
  const res = await fetch(path, { credentials: "include", ...opts });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function renderCart() {
  const mount = $("#cartItems");
  const totalEl = $("#cartTotal");
  const cart = getCart();

  const slugs = Object.keys(cart);
  if (slugs.length === 0) {
    mount.innerHTML = `<div class="card"><div class="cardPad"><p class="title">Your cart is empty</p><p class="desc">Add items from the shop to see them here.</p><a class="btn btn--primary" href="/shop">Go to shop</a></div></div>`;
    totalEl.textContent = "£0.00";
    return;
  }

  const { products } = await api(`/api/products?filter=all&sort=featured`);
  const bySlug = new Map(products.map(p => [p.slug, p]));
  let subtotal = 0;

  mount.innerHTML = slugs.map(slug => {
    const p = bySlug.get(slug);
    if (!p) return "";
    const qty = Number(cart[slug]) || 0;
    const price = (p.is_on_sale && p.sale_price_pence != null) ? p.sale_price_pence : p.price_pence;
    subtotal += price * qty;

    return `
      <div class="cartItem">
        <img src="${p.image_url || ""}" alt="${p.name}">
        <div class="p">
          <p class="name">${p.name}</p>
          <p class="small">${moneyPence(price)} • <button class="linkBtn" data-remove="${slug}">Remove</button></p>
          <div class="qtyRow">
            <button class="qtyBtn" data-dec="${slug}">−</button>
            <input class="qtyInput" value="${qty}" inputmode="numeric" data-qty="${slug}">
            <button class="qtyBtn" data-inc="${slug}">+</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  totalEl.textContent = moneyPence(subtotal);

  mount.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    const slug = btn.dataset.remove;
    const c = getCart();
    delete c[slug];
    setCart(c);
    renderCart();
  }));
  mount.querySelectorAll("[data-dec]").forEach(btn => btn.addEventListener("click", () => {
    const slug = btn.dataset.dec;
    const c = getCart();
    c[slug] = Math.max(0, (Number(c[slug])||0) - 1);
    if (c[slug] === 0) delete c[slug];
    setCart(c);
    renderCart();
  }));
  mount.querySelectorAll("[data-inc]").forEach(btn => btn.addEventListener("click", () => {
    const slug = btn.dataset.inc;
    const c = getCart();
    c[slug] = (Number(c[slug])||0) + 1;
    setCart(c);
    renderCart();
  }));
  mount.querySelectorAll("[data-qty]").forEach(inp => inp.addEventListener("change", () => {
    const slug = inp.dataset.qty;
    const q = Math.max(0, parseInt(inp.value, 10) || 0);
    const c = getCart();
    if (q === 0) delete c[slug];
    else c[slug] = q;
    setCart(c);
    renderCart();
  }));

  $("#clearCart")?.addEventListener("click", () => { setCart({}); renderCart(); });
}

renderCart();
