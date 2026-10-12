(() => {
  "use strict";

  const API_URL = `${window.PATAPRO_API_BASE || "/api"}/products`;
  const CART_KEY = "patapro_cart";

  const grid = document.getElementById("productGrid");
  const categoryFilters = document.getElementById("categoryFilters");
  const searchForm = document.getElementById("searchForm");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const emptyState = document.getElementById("emptyState");
  const resultSummary = document.getElementById("resultSummary");
  const cartCount = document.getElementById("cartCount");
  const toast = document.getElementById("toast");

  let allProducts = [];
  let selectedCategory = "";
  let toastTimeout;

  function readCart() {
    try {
      const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(cart) ? cart : [];
    } catch {
      return [];
    }
  }

  function updateCartCount() {
    const total = readCart().reduce(
      (sum, item) => sum + Math.max(0, Number(item.quantity) || 0),
      0
    );
    cartCount.textContent = total > 99 ? "99+" : String(total);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function safeImageUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.origin);
      if (!["http:", "https:"].includes(url.protocol)) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function formatPrice(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "Price unavailable";

    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 2
    }).format(amount);
  }

  function getProductId(product) {
    return String(product.id);
  }

  function renderCategories() {
    const categories = [...new Set(
      allProducts
        .map(product => String(product.category || "").trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    categoryFilters.innerHTML = "";

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className =
      "category-chip" + (selectedCategory === "" ? " active" : "");
    allButton.dataset.category = "";
    allButton.textContent = "All products";
    categoryFilters.appendChild(allButton);

    categories.forEach(category => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "category-chip" + (selectedCategory === category ? " active" : "");
      button.dataset.category = category;
      button.textContent = category;
      categoryFilters.appendChild(button);
    });
  }

  function getVisibleProducts() {
    const search = searchInput.value.trim().toLowerCase();

    const products = allProducts.filter(product => {
      const searchable = [
        product.name,
        product.description,
        product.category,
        product.seller_name
      ].join(" ").toLowerCase();

      const matchesSearch = searchable.includes(search);
      const matchesCategory =
        !selectedCategory ||
        String(product.category || "").toLowerCase() ===
          selectedCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    });

    switch (sortSelect.value) {
      case "price-low":
        products.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-high":
        products.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "name":
        products.sort((a, b) =>
          String(a.name).localeCompare(String(b.name))
        );
        break;
      default:
        products.sort((a, b) =>
          new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
    }

    return products;
  }

  function productCard(product) {
    const id = escapeHTML(getProductId(product));
    const name = escapeHTML(product.name || "Untitled product");
    const category = escapeHTML(product.category || "General");
    const description = escapeHTML(product.description || "");
    const seller = escapeHTML(product.seller_name || "PataPro seller");
    const image = safeImageUrl(product.image_url);
    const stock = Math.max(0, Number(product.stock_quantity) || 0);
    const imageMarkup = image
      ? `<img class="product-image" src="${escapeHTML(image)}"
             alt="${name}" loading="lazy">`
      : `<div class="product-placeholder" aria-label="No product image">🛍️</div>`;

    return `
      <article class="product-card">
        <a href="product.html?id=${encodeURIComponent(id)}"
           class="product-image-wrap" aria-label="View ${name}">
          ${imageMarkup}
        </a>
        <div class="product-info">
          <span class="product-category">${category}</span>
          <h3>
            <a href="product.html?id=${encodeURIComponent(id)}">${name}</a>
          </h3>
          <p class="product-description">${description}</p>
          <p class="product-seller">Seller: ${seller}</p>
          <div class="product-bottom">
            <span class="product-price">${formatPrice(product.price)}</span>
            <button
              type="button"
              class="add-cart"
              data-add-id="${id}"
              aria-label="Add ${name} to cart"
              title="${stock > 0 ? "Add to cart" : "Out of stock"}"
              ${stock <= 0 ? "disabled" : ""}
            >＋</button>
          </div>
          <p class="product-seller">${stock > 0 ? `${stock} available` : "Out of stock"}</p>
        </div>
      </article>
    `;
  }

  function renderProducts() {
    const products = getVisibleProducts();

    grid.innerHTML = "";
    resultSummary.textContent =
      `${products.length} product${products.length === 1 ? "" : "s"} found`;

    emptyState.classList.toggle("hidden", products.length > 0);
    products.forEach(product => grid.insertAdjacentHTML("beforeend", productCard(product)));
  }

  async function loadProducts() {
    loadingState.classList.remove("hidden");
    errorState.classList.add("hidden");
    emptyState.classList.add("hidden");
    grid.innerHTML = "";

    try {
      const response = await fetch(API_URL, {
        headers: { Accept: "application/json" }
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status})`);
      }

      if (Array.isArray(data)) {
        allProducts = data;
      } else if (Array.isArray(data.products)) {
        allProducts = data.products;
      } else {
        allProducts = [];
      }

      allProducts = allProducts.filter(product =>
        product && product.id != null
      );

      renderCategories();
      renderProducts();
    } catch (error) {
      console.error("Marketplace load error:", error);
      errorMessage.textContent =
        "The product API could not be reached. Check the server connection when we run final tests.";
      errorState.classList.remove("hidden");
    } finally {
      loadingState.classList.add("hidden");
    }
  }

  function addToCart(id) {
    const product = allProducts.find(item => getProductId(item) === id);

    if (!product) {
      showToast("Product could not be found.");
      return;
    }

    const stock = Math.max(0, Number(product.stock_quantity) || 0);

    if (stock < 1) {
      showToast("This product is out of stock.");
      return;
    }

    const cart = readCart();
    const existing = cart.find(item => String(item.productId) === id);
    const currentQuantity = existing
      ? Math.max(0, Number(existing.quantity) || 0)
      : 0;

    if (currentQuantity >= stock) {
      showToast("You have reached the available stock for this product.");
      return;
    }

    if (existing) {
      existing.quantity = currentQuantity + 1;
      existing.name = product.name;
      existing.price = Number(product.price);
      existing.imageUrl = product.image_url || "";
      existing.stockQuantity = stock;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        imageUrl: product.image_url || "",
        quantity: 1,
        stockQuantity: stock
      });
    }

    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
    showToast(`${product.name} added to your cart.`);
  }

  searchForm.addEventListener("submit", event => {
    event.preventDefault();
    renderProducts();
  });

  searchInput.addEventListener("input", renderProducts);
  sortSelect.addEventListener("change", renderProducts);

  categoryFilters.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    selectedCategory = button.dataset.category || "";
    renderCategories();
    renderProducts();
  });

  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-add-id]");
    if (button) addToCart(button.dataset.addId);
  });

  document.getElementById("retryButton").addEventListener("click", loadProducts);

  document.getElementById("clearFiltersButton").addEventListener("click", () => {
    searchInput.value = "";
    selectedCategory = "";
    renderCategories();
    renderProducts();
  });

  document.getElementById("year").textContent = new Date().getFullYear();

  updateCartCount();
  loadProducts();
})();
