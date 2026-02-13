const $ = (sel) => document.querySelector(sel);

async function api(path, opts={}) {
  const res = await fetch(path, { credentials: "include", ...opts });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function moneyFromPence(p) {
  const n = Number(p);
  return Number.isFinite(n) ? (n/100).toFixed(2) : "0.00";
}

async function checkMe() {
  try {
    const { user } = await api("/api/auth/me");
    $("#who").textContent = user.email;
    $("#authPanel").hidden = true;
    $("#adminPanel").hidden = false;
    await loadProducts();
  } catch {
    $("#authPanel").hidden = false;
    $("#adminPanel").hidden = true;
  }
}

$("#loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#loginErr").textContent = "";
  try {
    await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        email: $("#email").value,
        password: $("#password").value
      })
    });
    await checkMe();
  } catch (err) {
    $("#loginErr").textContent = err.message;
  }
});

$("#logout")?.addEventListener("click", async () => {
  await api("/api/auth/logout", { method:"POST" });
  await checkMe();
});

async function loadProducts() {
  const { products } = await api("/api/products?filter=all&sort=name-asc");
  const tbody = $("#prodTable");
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>£${moneyFromPence(p.price_pence)}</td>
      <td>${p.stock}</td>
      <td>
        <button class="btn" data-edit="${p.id}">Edit</button>
        <button class="btn" data-del="${p.id}">Delete</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Delete this product?")) return;
    await api(`/api/admin/products/${btn.dataset.del}`, { method:"DELETE" });
    await loadProducts();
  }));

  tbody.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", async () => {
    const id = btn.dataset.edit;
    const { products } = await api("/api/products?filter=all&sort=featured");
    const p = products.find(x => String(x.id) === String(id));
    if (!p) return;

    $("#pid").value = p.id;
    $("#pname").value = p.name;
    $("#pdesc").value = p.description || "";
    $("#pcat").value = p.category || "";
    $("#pprice").value = moneyFromPence(p.price_pence);
    $("#psale").value = p.sale_price_pence != null ? moneyFromPence(p.sale_price_pence) : "";
    $("#pstock").value = p.stock;
    $("#pnew").checked = !!p.is_new;
    $("#pbest").checked = !!p.is_best_seller;
    $("#psaleFlag").checked = !!p.is_on_sale;
    $("#pimgurl").value = p.image_url || "";
    $("#formTitle").textContent = "Edit product";
    window.scrollTo({ top: 0, behavior:"smooth" });
  }));
}

$("#resetForm")?.addEventListener("click", () => {
  $("#pid").value = "";
  $("#formTitle").textContent = "Add product";
  $("#productForm").reset();
});

$("#productForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#saveErr").textContent = "";

  const id = $("#pid").value;
  const fd = new FormData();
  fd.append("name", $("#pname").value);
  fd.append("description", $("#pdesc").value);
  fd.append("category", $("#pcat").value);
  fd.append("price", $("#pprice").value);
  fd.append("sale_price", $("#psale").value);
  fd.append("stock", $("#pstock").value);
  fd.append("is_new", $("#pnew").checked);
  fd.append("is_best_seller", $("#pbest").checked);
  fd.append("is_on_sale", $("#psaleFlag").checked);
  fd.append("image_url", $("#pimgurl").value);

  const file = $("#pimgfile").files?.[0];
  if (file) fd.append("image", file);

  try {
    if (id) {
      await api(`/api/admin/products/${id}`, { method:"PUT", body: fd });
    } else {
      await api(`/api/admin/products`, { method:"POST", body: fd });
    }
    $("#resetForm").click();
    await loadProducts();
  } catch (err) {
    $("#saveErr").textContent = err.message;
  }
});

checkMe();
