(() => {
  "use strict";

  const CART_KEY = "patapro_cart";
  const API_URL = `${window.PATAPRO_API_BASE || "/api"}/products`;

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  const loading = document.getElementById("loading");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const productDetails = document.getElementById("productDetails");
  const productImage = document.getElementById("productImage");
  const imagePlaceholder = document.getElementById("imagePlaceholder");
  const quantityInput = document.getElementById("quantity");
  const addButton = document.getElementById("addToCart");
  const cartCount = document.getElementById("cartCount");
  const toast = document.getElementById("toast");

  let currentProduct = null;
  let toastTimeout;

  function readCart() {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(value) ? value : [];
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

  function formatPrice(value) {
    const price = Number(value);

    if (!Number.isFinite(price)) return "Price unavailable";

    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 2
    }).format(price);
  }

  function showError(message) {
    loading.classList.add("hidden");
    productDetails.classList.add("hidden");
    errorMessage.textContent = message;
    errorState.classList.remove("hidden");
  }

  function validImageUrl(value) {
    if (!value) return "";

    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function displayProduct(product) {
    currentProduct = product;

    document.title = `${product.name || "Product"} | PataPro Kenya`;
    document.getElementById("breadcrumbName").textContent =
      product.name || "Product details";
    document.getElementById("productCategory").textContent =
      product.category || "General";
    document.getElementById("productName").textContent =
      product.name || "Untitled product";
    document.getElementById("productPrice").textContent =
      formatPrice(product.price);
    document.getElementById("productDescription").textContent =
      product.description || "No description provided.";
    document.getElementById("sellerName").textContent =
      product.seller_name || "PataPro seller";

    const stock = Math.max(0, Number(product.stock_quantity) || 0);
    const stockStatus = document.getElementById("stockStatus");

    stockStatus.textContent = stock > 0
      ? `${stock} available`
      : "Out of stock";

    stockStatus.classList.toggle("out-of-stock", stock <= 0);

    quantityInput.max = String(Math.max(stock, 1));
    quantityInput.value = "1";
    quantityInput.disabled = stock <= 0;
    addButton.disabled = stock <= 0;
    addButton.textContent = stock > 0 ? "Add to cart" : "Out of stock";

    const imageUrl = validImageUrl(product.image_url);

    if (imageUrl) {
      productImage.src = imageUrl;
      productImage.alt = product.name || "Product image";
      productImage.classList.remove("hidden");
      imagePlaceholder.classList.add("hidden");

      productImage.onerror = () => {
        productImage.classList.add("hidden");
        imagePlaceholder.classList.remove("hidden");
      };
    } else {
      productImage.classList.add("hidden");
      imagePlaceholder.classList.remove("hidden");
    }

    loading.classList.add("hidden");
    errorState.classList.add("hidden");
    productDetails.classList.remove("hidden");
  }

  async function loadProduct() {
    if (!productId || !/^\d+$/.test(productId) || Number(productId) <= 0) {
      showError("The product link is missing a valid product ID.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(productId)}`,
        { headers: { Accept: "application/json" } }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "This product could not be found.");
      }

      const product = data.product || data;

      if (!product || product.id == null) {
        throw new Error("The server returned invalid product information.");
      }

      displayProduct(product);
    } catch (error) {
      console.error("Load product error:", error);
      showError(error.message || "Unable to load this product.");
    }
  }

  function addToCart() {
    if (!currentProduct) return;

    const stock = Math.max(
      0,
      Number(currentProduct.stock_quantity) || 0
    );

    const quantity = Number(quantityInput.value);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > stock
    ) {
      showToast(`Choose a quantity between 1 and ${stock}.`);
      return;
    }

    const cart = readCart();
    const id = String(currentProduct.id);
    const existing = cart.find(
      item => String(item.productId) === id
    );
    const currentQuantity = existing
      ? Math.max(0, Number(existing.quantity) || 0)
      : 0;

    if (currentQuantity + quantity > stock) {
      showToast("Your cart quantity would exceed the available stock.");
      return;
    }

    if (existing) {
      existing.quantity = currentQuantity + quantity;
      existing.name = currentProduct.name;
      existing.price = Number(currentProduct.price);
      existing.imageUrl = currentProduct.image_url || "";
      existing.stockQuantity = stock;
    } else {
      cart.push({
        productId: currentProduct.id,
        name: currentProduct.name,
        price: Number(currentProduct.price),
        imageUrl: currentProduct.image_url || "",
        quantity,
        stockQuantity: stock
      });
    }

    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
    showToast("Product added to your cart.");
  }

  document.getElementById("decreaseQuantity").addEventListener("click", () => {
    const current = Number(quantityInput.value) || 1;
    quantityInput.value = String(Math.max(1, current - 1));
  });

  document.getElementById("increaseQuantity").addEventListener("click", () => {
    const current = Number(quantityInput.value) || 1;
    const max = Number(quantityInput.max) || 1;
    quantityInput.value = String(Math.min(max, current + 1));
  });

  quantityInput.addEventListener("change", () => {
    const max = Number(quantityInput.max) || 1;
    const value = Number(quantityInput.value);
    quantityInput.value = String(
      Number.isInteger(value) ? Math.min(max, Math.max(1, value)) : 1
    );
  });

  addButton.addEventListener("click", addToCart);
  document.getElementById("year").textContent = new Date().getFullYear();

  updateCartCount();
  loadProduct();
})();
