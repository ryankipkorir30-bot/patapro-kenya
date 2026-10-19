(() => {
  "use strict";

  const API = window.PATAPRO_API_BASE || "/api";
  const $ = id => document.getElementById(id);
  const getToken = () => localStorage.getItem("patapro_token");

  let items = [];
  let busy = false;

  async function api(path, options = {}) {
    const token = getToken();

    if (!token) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      location.href = `login.html?redirect=${redirect}`;
      throw new Error("Please log in to view your cart.");
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}

    if (!response.ok) {
      throw new Error(data.message || `Request failed (${response.status}).`);
    }
    return data;
  }

  function money(value) {
    return "KSh " + Number(value || 0).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function message(text, isError = false) {
    const box = $("checkoutMessage") || $("toast");
    if (box) {
      box.textContent = text;
      box.style.display = text ? "block" : "none";
      box.style.color = isError ? "#dc2626" : "#15803d";
    } else if (text) {
      console.log(text);
    }
  }

  function render() {
    const container = $("cartItems");
    const empty = $("emptyCart");
    const count = items.reduce((n, item) => n + Number(item.quantity || 0), 0);
    const total = items.reduce((n, item) =>
      n + Number(item.subtotal ?? Number(item.price || 0) * Number(item.quantity || 0)), 0);

    if ($("cartCount")) $("cartCount").textContent = count;
    if ($("summaryQuantity")) $("summaryQuantity").textContent = count;
    if ($("itemSummary")) $("itemSummary").textContent = count;
    if ($("subtotal")) $("subtotal").textContent = money(total);
    if ($("total")) $("total").textContent = money(total);

    if (empty) empty.style.display = items.length ? "none" : "block";
    if (!container) {
      message("Cart page is missing the cartItems element.", true);
      return;
    }

    container.replaceChildren();

    if (!items.length) {
      const p = document.createElement("p");
      p.textContent = "Your cart is empty. Visit a business page and add a service.";
      container.append(p);
      return;
    }

    items.forEach(item => {
      const id = Number(item.service_id);
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || 0);
      const subtotal = Number(item.subtotal ?? price * qty);

      const card = document.createElement("article");
      card.className = "cart-item";
      card.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:16px;margin-bottom:12px;border:1px solid #ddd;border-radius:12px";

      const details = document.createElement("div");
      details.style.flex = "1";

      const title = document.createElement("h3");
      title.textContent = item.service_name || "Service";

      const business = document.createElement("p");
      business.textContent = item.business_name ? `Business: ${item.business_name}` : "";

      const description = document.createElement("p");
      description.textContent = item.description || "";

      const priceText = document.createElement("p");
      priceText.textContent = `${money(price)}${item.price_type ? " · " + item.price_type : ""} each`;

      const subtotalText = document.createElement("strong");
      subtotalText.textContent = `Subtotal: ${money(subtotal)}`;

      details.append(title, business, description, priceText, subtotalText);

      const controls = document.createElement("div");
      controls.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap";

      function makeButton(label, action, disabled = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.id = String(id);
        button.disabled = disabled || busy;
        return button;
      }

      const quantity = document.createElement("span");
      quantity.textContent = String(qty);

      controls.append(
        makeButton("−", "decrease", qty <= 1),
        quantity,
        makeButton("+", "increase", qty >= 100),
        makeButton("Remove", "remove")
      );

      card.append(details, controls);
      container.append(card);
    });

    const checkout = $("checkoutButton");
    if (checkout) checkout.disabled = items.length === 0 || busy;
  }

  async function loadCart() {
    try {
      const data = await api("/cart");
      items = Array.isArray(data.items) ? data.items : [];
      render();
      message("");
    } catch (error) {
      message(error.message || "Could not load cart.", true);
    }
  }

  async function updateItem(id, action) {
    if (busy) return;

    const item = items.find(row => Number(row.service_id) === id);
    if (!item) return;

    busy = true;
    render();

    try {
      if (action === "remove") {
        await api(`/cart/${id}`, { method: "DELETE" });
      } else {
        const current = Number(item.quantity || 1);
        const quantity = action === "increase" ? current + 1 : current - 1;
        if (quantity < 1 || quantity > 100) return;

        await api(`/cart/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity })
        });
      }

      const data = await api("/cart");
      items = Array.isArray(data.items) ? data.items : [];
      message("");
    } catch (error) {
      message(error.message || "Could not update cart.", true);
    } finally {
      busy = false;
      render();
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    if (Number.isInteger(id) && id > 0 &&
        ["increase", "decrease", "remove"].includes(action)) {
      updateItem(id, action);
    }
  });

  const checkoutButton = $("checkoutButton");
  if (checkoutButton) {
    checkoutButton.addEventListener("click", event => {
      event.preventDefault();

      if (!getToken()) {
        location.href = `login.html?redirect=${encodeURIComponent("service-checkout.html")}`;
        return;
      }

      if (!items.length) {
        message("Your cart is empty. Add a service first.", true);
        return;
      }

      location.href = "service-checkout.html";
    });
  }

  loadCart();
})();
