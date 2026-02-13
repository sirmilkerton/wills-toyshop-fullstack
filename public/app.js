const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  products: [],
  filter: "all",
  sort: "featured",
  category: "",
  q: ""
};

function moneyPence(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return "£0.00";
  return `£${(n/100).toFixed(2)}`;
}

function effectivePrice(p) {
  return (p.is_on_sale && p.sale_price_pence != null) ? p.sale_price_pence : p.price_pence;
}

function getCart() {
  try { return JSON.parse(localStorage.getItem("cart") || "{}"); } catch { return {}; }
}
function setCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartBadge();
}
function cartQtyTotal(cart) {
  return Object.values(cart).reduce((a,b)=>a + (Number(b)||0), 0);
}
function updateCartBadge() {
  const el = $("#cartCount");
  if (!el) return;
  const total = cartQtyTotal(getCart());
  el.textContent = String(total);
}
updateCartBadge();

function themeInit() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  const label = $("#themeLabel");
  if (label) label.textContent = (saved === "dark") ? "Light" : "Dark";
  $("#themeToggle")?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = (cur === "dark") ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    if (label) label.textContent = (next === "dark") ? "Light" : "Dark";
  });
}
themeInit();

async function api(path, opts={}) {
  const res = await fetch(path, { credentials: "include", ...opts });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadProducts() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category) params.set("category", state.category);
  if (state.filter) params.set("filter", state.filter);
  if (state.sort) params.set("sort", state.sort);

  const { products } = await api(`/api/products?${params.toString()}`);
  state.products = products;
}

function uniqCategories(products) {
  const map = new Map();
  for (const p of products) {
    map.set(p.category, (map.get(p.category) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]);
}

function productCard(p) {
  const tags = [];
  if (p.is_new) tags.push(`<span class="tag tagStrong">New</span>`);
  if (p.is_on_sale) tags.push(`<span class="tag">Sale</span>`);
  if (p.stock <= 0) tags.push(`<span class="tag">Out</span>`);

  const price = effectivePrice(p);
  const showSale = p.is_on_sale && p.sale_price_pence != null && p.sale_price_pence < p.price_pence;

  return `
    <article class="card product" data-product="${p.slug}">
      <div class="thumb">
        <img src="${p.image_url || ""}" alt="${p.name}">
      </div>
      <div class="cardPad">
        <div class="meta">${tags.join("")}</div>
        <h3 class="title">${p.name}</h3>
        <p class="desc">${p.description || ""}</p>
        <div class="row">
          <div class="price">
            ${showSale ? `<span class="old">${moneyPence(p.price_pence)}</span>` : ""}
            ${moneyPence(price)}
          </div>
          <button class="cta" data-add="${p.slug}" ${p.stock<=0 ? "disabled" : ""}>Add</button>
        </div>
      </div>
    </article>
  `;
}

// ---------- Cart drawer ----------
const backdrop = $("#drawerBackdrop");
const drawer = $("#cartDrawer");
function openDrawer() {
  backdrop?.classList.add("open");
  drawer?.classList.add("open");
  renderDrawer();
}
function closeDrawer() {
  backdrop?.classList.remove("open");
  drawer?.classList.remove("open");
}
backdrop?.addEventListener("click", closeDrawer);
$("#drawerClose")?.addEventListener("click", closeDrawer);

function addToCart(slug, qty=1) {
  const cart = getCart();
  cart[slug] = (Number(cart[slug]) || 0) + qty;
  if (cart[slug] <= 0) delete cart[slug];
  setCart(cart);
}

function removeFromCart(slug) {
  const cart = getCart();
  delete cart[slug];
  setCart(cart);
}

function setCartQty(slug, qty) {
  const cart = getCart();
  const q = Math.max(0, parseInt(qty,10) || 0);
  if (q === 0) delete cart[slug];
  else cart[slug] = q;
  setCart(cart);
}

function cartItemsDetailed() {
  const cart = getCart();
  const bySlug = new Map(state.products.map(p => [p.slug, p]));
  const items = [];
  for (const [slug, qty] of Object.entries(cart)) {
    const p = bySlug.get(slug);
    if (!p) continue;
    items.push({ p, qty: Number(qty)||0 });
  }
  return items;
}

function renderDrawer() {
  const body = $("#drawerBody");
  const subtotalEl = $("#drawerSubtotal");
  if (!body || !subtotalEl) return;

  const items = cartItemsDetailed();
  let subtotal = 0;
  if (items.length === 0) {
    body.innerHTML = `<div class="smallNote">Your cart is empty. Add something you love.</div>`;
    subtotalEl.textContent = "£0.00";
    return;
  }

  body.innerHTML = items.map(({p, qty}) => {
    const price = effectivePrice(p);
    subtotal += price * qty;
    return `
      <div class="cartItem">
        <img src="${p.image_url || ""}" alt="${p.name}">
        <div class="p">
          <p class="name">${p.name}</p>
          <p class="small">${moneyPence(price)} • <button class="linkBtn" data-remove="${p.slug}">Remove</button></p>
          <div class="qtyRow">
            <button class="qtyBtn" data-dec="${p.slug}">−</button>
            <input class="qtyInput" value="${qty}" inputmode="numeric" data-qty="${p.slug}">
            <button class="qtyBtn" data-inc="${p.slug}">+</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  subtotalEl.textContent = moneyPence(subtotal);

  body.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => removeFromCart(btn.dataset.remove)));
  body.querySelectorAll("[data-dec]").forEach(btn => btn.addEventListener("click", () => {
    const slug = btn.dataset.dec;
    const cart = getCart();
    setCartQty(slug, (Number(cart[slug])||0) - 1);
  }));
  body.querySelectorAll("[data-inc]").forEach(btn => btn.addEventListener("click", () => {
    const slug = btn.dataset.inc;
    const cart = getCart();
    setCartQty(slug, (Number(cart[slug])||0) + 1);
  }));
  body.querySelectorAll("[data-qty]").forEach(inp => inp.addEventListener("change", () => setCartQty(inp.dataset.qty, inp.value)));
}

// ---------- Quick View modal ----------
const modalBackdrop = $("#modalBackdrop");
const modal = $("#quickModal");
function openModal(product) {
  if (!modal || !modalBackdrop) return;
  modalBackdrop.classList.add("open");
  modal.classList.add("open");
  $("#qmImg").innerHTML = `<img src="${product.image_url || ""}" alt="${product.name}">`;
  $("#qmTitle").textContent = product.name;
  $("#qmDesc").textContent = product.description || "";
  $("#qmPrice").textContent = moneyPence(effectivePrice(product));
  $("#qmAdd").onclick = () => { addToCart(product.slug, 1); openDrawer(); };
  $("#qmView").href = `/product?id=${encodeURIComponent(product.slug)}`;
}
function closeModal() {
  modalBackdrop?.classList.remove("open");
  modal?.classList.remove("open");
}
modalBackdrop?.addEventListener("click", closeModal);
$("#qmClose")?.addEventListener("click", closeModal);

async function initShop() {
  if (!$("#productGrid")) return;

  await loadProducts();
  updateCartBadge();

  const cats = uniqCategories(state.products);
  const grid = $("#categoryGrid");
  if (grid) {
    const buttons = [
      `<button class="chip ${state.category ? "" : "chipActive"}" data-cat="">All</button>`,
      ...cats.map(([c, count]) => `<button class="chip ${state.category===c ? "chipActive":""}" data-cat="${c}">${c} <span style="opacity:.7">(${count})</span></button>`)
    ];
    grid.innerHTML = buttons.join("");
    grid.querySelectorAll("[data-cat]").forEach(btn => btn.addEventListener("click", async () => {
      state.category = btn.dataset.cat || "";
      await initShop(); // re-render with new counts and products
    }));
  }

  // Filters
  $$(".tab").forEach(t => t.addEventListener("click", async () => {
    $$(".tab").forEach(x=>x.classList.remove("chipActive","is-active"));
    t.classList.add("is-active");
    state.filter = t.dataset.filter || "all";
    await initShop();
  }));

  $("#sort")?.addEventListener("change", async (e) => {
    state.sort = e.target.value || "featured";
    await initShop();
  });

  $("#clearFilters")?.addEventListener("click", async () => {
    state.category = "";
    state.filter = "all";
    state.sort = "featured";
    const active = $(".tab.is-active");
    active?.classList.remove("is-active");
    $(".tab[data-filter='all']")?.classList.add("is-active");
    $("#sort").value = "featured";
    await initShop();
  });

  // Render products
  const list = state.products;
  $("#resultsCount").textContent = `Showing ${list.length} item${list.length===1?"":"s"}`;
  $("#productGrid").innerHTML = list.map(productCard).join("");

  // Card click => quick view; Add button => add to cart + drawer
  $("#productGrid").querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const slug = btn.dataset.add;
      addToCart(slug, 1);
      openDrawer();
    });
  });

  $("#productGrid").querySelectorAll("[data-product]").forEach(card => {
    card.addEventListener("click", () => {
      const slug = card.dataset.product;
      const p = state.products.find(x => x.slug === slug);
      if (p) openModal(p);
    });
  });

  // Sale section
  const saleGrid = $("#saleGrid");
  if (saleGrid) {
    const sale = state.products.filter(p => p.is_on_sale).slice(0,6);
    saleGrid.innerHTML = sale.length ? sale.map(productCard).join("") : `<div class="smallNote">No sale items yet.</div>`;
    saleGrid.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(btn.dataset.add, 1);
      openDrawer();
    }));
    saleGrid.querySelectorAll("[data-product]").forEach(card => card.addEventListener("click", () => {
      const p = state.products.find(x => x.slug === card.dataset.product);
      if (p) openModal(p);
    }));
  }

  // Open drawer button
  $("#openCart")?.addEventListener("click", openDrawer);
}

async function initProductPage() {
  const mount = $("#productMount");
  if (!mount) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) { mount.innerHTML = "<p>Missing product id.</p>"; return; }

  const { product } = await api(`/api/products/${encodeURIComponent(id)}`);
  // load list too for related + drawer rendering
  await loadProducts();

  mount.innerHTML = `
    <div class="card">
      <div class="modalGrid">
        <div class="modalImg"><img src="${product.image_url || ""}" alt="${product.name}"></div>
        <div class="modalBody">
          <div class="meta">
            ${product.is_new ? `<span class="tag tagStrong">New</span>` : ""}
            ${product.is_on_sale ? `<span class="tag">Sale</span>` : ""}
            <span class="tag">${product.category}</span>
          </div>
          <h2 class="title" style="font-size:22px">${product.name}</h2>
          <p class="desc" style="min-height:auto">${product.description || ""}</p>
          <div class="row" style="margin-top:12px">
            <div class="price" style="font-size:18px">${moneyPence(effectivePrice(product))}</div>
            <button class="btn btn--primary" id="pdAdd">Add to cart</button>
          </div>
          <div class="rule"></div>
          <p class="smallNote">In stock: ${product.stock}</p>
        </div>
      </div>
    </div>
  `;

  $("#pdAdd").addEventListener("click", () => { addToCart(product.slug, 1); openDrawer(); });

  // Related
  const related = state.products.filter(p => p.category === product.category && p.slug !== product.slug).slice(0,3);
  const rel = $("#relatedGrid");
  if (rel) rel.innerHTML = related.map(productCard).join("");
  rel?.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", (e)=>{ e.stopPropagation(); addToCart(btn.dataset.add, 1); openDrawer(); }));
  rel?.querySelectorAll("[data-product]").forEach(card => card.addEventListener("click", ()=> {
    location.href = `/product?id=${encodeURIComponent(card.dataset.product)}`;
  }));

  $("#openCart")?.addEventListener("click", openDrawer);
}

async function initHome() {
  if (!$("#featuredGrid")) return;
  await loadProducts();
  const picks = state.products
    .slice()
    .sort((a,b)=> (b.is_best_seller - a.is_best_seller) || (b.stock - a.stock))
    .slice(0,6);

  $("#featuredGrid").innerHTML = picks.map(productCard).join("");
  $("#featuredGrid").querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", (e)=>{ e.stopPropagation(); addToCart(btn.dataset.add,1); openDrawer(); }));
  $("#featuredGrid").querySelectorAll("[data-product]").forEach(card => card.addEventListener("click", ()=> {
    const slug = card.dataset.product;
    const p = state.products.find(x=>x.slug===slug);
    if (p) openModal(p);
  }));
  $("#openCart")?.addEventListener("click", openDrawer);

  $("#ctaShop")?.addEventListener("click", ()=> location.href = "/shop");
}

document.addEventListener("click", (e) => {
  const openCart = e.target.closest("[data-open-cart]");
  if (openCart) openDrawer();
});

async function boot() {
  // Ensure bootstrap admin exists (optional convenience)
  try { await api("/api/admin/bootstrap", { method: "POST" }); } catch {}

  await Promise.allSettled([initHome(), initShop(), initProductPage()]);
  updateCartBadge();
}
boot();
