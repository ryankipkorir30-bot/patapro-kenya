(() => {
  "use strict";

  const API = `${window.PATAPRO_API_BASE || "http://localhost:5000/api"}/products`;
  const token = localStorage.getItem("patapro_token");

  const form = document.getElementById("spProductForm");
  const list = document.getElementById("spProductList");
  const message = document.getElementById("spMessage");
  const submit = document.getElementById("spSubmit");
  const cancelEdit = document.getElementById("spCancelEdit");
  const productId = document.getElementById("spProductId");

  if (!form || !list) return;

  const field = id => document.getElementById(id);

  function showMessage(text, type = "success") {
    message.textContent = text;
    message.className = "sp-message " + (type === "error" ? "sp-error" : "sp-success");
    message.hidden = false;
  }

  async function request(url, options = {}) {
    if (!token) {
      throw new Error("Please log in before managing products.");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error("The server returned an unexpected response. Check that the API is running."); }

    if (!response.ok) {
      throw new Error(data.message || `Request failed (${response.status}).`);
    }

    return data;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function statusLabel(status) {
    return ({
      draft: "Pending approval",
      published: "Published",
      archived: "Archived"
    })[status] || status || "Unknown";
  }

  function resetForm() {
    form.reset();
    productId.value = "";
    field("spFormTitle").textContent = "Create Product Listing";
    submit.textContent = "Submit for Approval";
    cancelEdit.hidden = true;
  }

  function renderProducts(products) {
    if (!products.length) {
      list.innerHTML = "<p>No products yet. Add your first product using the form above.</p>";
      return;
    }

    list.innerHTML = products.map(p => {
      const id = Number(p.id);
      const status = String(p.status || "draft");
      const image = p.image_url || p.imageUrl;
      const imageHTML = image
        ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(p.name)}" loading="lazy" referrerpolicy="no-referrer">`
        : "";

      const actions = status !== "archived" ? `
        <div class="sp-actions">
          <button type="button" class="sp-btn secondary" data-edit="${id}">Edit</button>
          <button type="button" class="sp-btn archive" data-archive="${id}">Archive</button>
        </div>` : "";

      return `
        <article class="sp-product">
          ${imageHTML}
          <h4>${escapeHTML(p.name)}</h4>
          <span class="sp-status ${escapeHTML(status)}">${escapeHTML(statusLabel(status))}</span>
          <p>${escapeHTML(p.category)}</p>
          <p><strong>KSh ${Number(p.price || 0).toLocaleString("en-KE", {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></p>
          <p class="sp-muted">Stock: ${escapeHTML(p.stock_quantity ?? p.stockQuantity ?? 0)}</p>
          <p>${escapeHTML(p.description)}</p>
          ${actions}
        </article>`;
    }).join("");
  }

  async function loadProducts() {
    list.innerHTML = "<p>Loading your listings…</p>";
    try {
      const data = await request(`${API}/seller/mine`);
      renderProducts(data.products || []);
    } catch (error) {
      list.innerHTML = "";
      showMessage(error.message, "error");
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const payload = {
      name: field("spName").value.trim(),
      category: field("spCategory").value.trim(),
      description: field("spDescription").value.trim(),
      price: field("spPrice").value,
      stockQuantity: field("spStock").value,
      imageUrl: field("spImageUrl").value.trim()
    };

    submit.disabled = true;
    submit.textContent = "Saving…";

    try {
      const id = productId.value;
      const data = await request(id ? `${API}/${encodeURIComponent(id)}` : API, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });

      showMessage(data.message || (id ? "Product updated." : "Product submitted for approval."));
      resetForm();
      await loadProducts();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      submit.disabled = false;
      if (!productId.value) submit.textContent = "Submit for Approval";
    }
  });

  list.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit]");
    const archiveButton = event.target.closest("[data-archive]");

    if (editButton) {
      try {
        const data = await request(`${API}/seller/mine`);
        const product = (data.products || []).find(p => Number(p.id) === Number(editButton.dataset.edit));
        if (!product) throw new Error("Product not found in your listings.");

        productId.value = product.id;
        field("spName").value = product.name || "";
        field("spCategory").value = product.category || "";
        field("spDescription").value = product.description || "";
        field("spPrice").value = product.price ?? "";
        field("spStock").value = product.stock_quantity ?? product.stockQuantity ?? 0;
        field("spImageUrl").value = product.image_url || product.imageUrl || "";
        field("spFormTitle").textContent = "Edit Product Listing";
        submit.textContent = "Save Changes";
        cancelEdit.hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        showMessage(error.message, "error");
      }
      return;
    }

    if (archiveButton) {
      const id = archiveButton.dataset.archive;
      if (!confirm("Archive this product? It will no longer be available as an active listing.")) return;

      archiveButton.disabled = true;
      try {
        const data = await request(`${API}/${encodeURIComponent(id)}/archive`, { method: "PATCH" });
        showMessage(data.message || "Product archived.");
        await loadProducts();
      } catch (error) {
        showMessage(error.message, "error");
        archiveButton.disabled = false;
      }
    }
  });

  cancelEdit.addEventListener("click", resetForm);
  document.getElementById("spRefresh").addEventListener("click", loadProducts);

  loadProducts();
})();
