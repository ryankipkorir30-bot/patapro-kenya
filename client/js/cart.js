(() => {
  "use strict";

  const CART_KEY = "patapro_cart";

  const cartItems = document.getElementById("cartItems");
  const emptyCart = document.getElementById("emptyCart");
  const cartCount = document.getElementById("cartCount");
  const itemSummary = document.getElementById("itemSummary");
  const summaryQuantity = document.getElementById("summaryQuantity");
  const subtotalElement = document.getElementById("subtotal");
  const totalElement = document.getElementById("total");
  const checkoutButton = document.getElementById("checkoutButton");
  const checkoutMessage = document.getElementById("checkoutMessage");
  const toast = document.getElementById("toast");

  let toastTimeout;

  function readCart() {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
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

  function imageUrl(value) {
    if (!value) return "";

    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
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

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function validQuantity(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : 1;
  }

  function getStock(item) {
    const stock = Number(item.stockQuantity);
    return Number.isInteger(stock) && stock >= 0 ? stock : 0;
  }

  function renderItem(item) {
    const id = escapeHTML(String(item.productId));
    const name = escapeHTML(item.name || "Product");
    const image = imageUrl(item.imageUrl);
    const quantity = validQuantity(item.quantity);
    const stock = getStock(item);
    const price = Number(item.price);
    const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
    const thumbnail = image
      ? `<img src="${escapeHTML(image)}" alt="${name}" loading="lazy">`
      : "🛍️";

    return `
      <article class="cart-item" data-product-id="${id}">
        <a class="item-image" href="product.html?id=${encodeURIComponent(id)}">
          ${thumbnail}
        </a>

        <div class="item-details">
          <span class="item-category">PataPro product</span>
          <h3 class="item-name">
            <a href="product.html?id=${encodeURIComponent(id)}">${name}</a>
          </h3>
          <div class="item-price">${formatPrice(safePrice)} each</div>
          <div class="item-stock">${stock > 0 ? `${stock} available when added` : "Availability must be checked"}</div>

          <div class="item-actions">
            <div class="quantity-control" aria-label="Change quantity">
              <button type="button" data-action="decrease" data-id="${id}"
                aria-label="Decrease quantity">−</button>
              <span>${quantity}</span>
              <button type="button" data-action="increase" data-id="${id}"
                aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="remove-button"
              data-action="remove" data-id="${id}">Remove</button>
          </div>
        </div>

        <div class="item-total">${formatPrice(safePrice * quantity)}</div>
      </article>
    `;
  }

  function render() {
    const cart = readCart().filter(item =>
      item && item.productId != null
    );

    if (cart.length !== readCart().length) saveCart(cart);

    const quantityTotal = cart.reduce(
      (sum, item) => sum + validQuantity(item.quantity),
      0
    );

    const subtotal = cart.reduce((sum, item) => {
      const price = Number(item.price);
      const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
      return sum + safePrice * validQuantity(item.quantity);
    }, 0);

    cartCount.textContent = quantityTotal > 99 ? "99+" : String(quantityTotal);
    itemSummary.textContent =
      `${quantityTotal} item${quantityTotal === 1 ? "" : "s"}`;
    summaryQuantity.textContent = String(quantityTotal);
    subtotalElement.textContent = formatPrice(subtotal);
    totalElement.textContent = formatPrice(subtotal);

    cartItems.innerHTML = cart.map(renderItem).join("");
    emptyCart.classList.toggle("hidden", cart.length > 0);
    checkoutButton.disabled = cart.length === 0;
    checkoutMessage.classList.add("hidden");
  }

  function changeQuantity(id, action) {
    const cart = readCart();
    const item = cart.find(entry => String(entry.productId) === id);

    if (!item) return;

    const quantity = validQuantity(item.quantity);
    const stock = getStock(item);

    if (action === "increase") {
      if (stock > 0 && quantity >= stock) {
        showToast("You have reached the saved stock limit.");
        return;
      }

      item.quantity = quantity + 1;
    } else if (action === "decrease") {
      if (quantity <= 1) {
        showToast("Use Remove if you want to delete this product.");
        return;
      }

      item.quantity = quantity - 1;
    } else if (action === "remove") {
      saveCart(cart.filter(entry => String(entry.productId) !== id));
      render();
      showToast("Product removed from your cart.");
      return;
    }

    saveCart(cart);
    render();
  }

  cartItems.addEventListener("click", event => {
    const button = event.target.closest("[data-action][data-id]");
    if (!button) return;

    changeQuantity(button.dataset.id, button.dataset.action);
  });

  checkoutButton.addEventListener("click", () => {
    const cart = readCart();

    if (!cart.length) {
      showToast("Your cart is empty.");
      return;
    }

    const token = localStorage.getItem("patapro_token");

    if (!token) {
      const returnUrl = "checkout.html";
      window.location.href = `login.html?redirect=${encodeURIComponent(returnUrl)}`;
      return;
    }

    // Checkout page will be connected in the next stage.
    window.location.href = "checkout.html";
  });

  document.getElementById("year").textContent = new Date().getFullYear();

  render();
})();
