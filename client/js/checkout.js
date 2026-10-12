const API_URL = window.PATAPRO_API_BASE || `${window.location.origin}/api`;

const form = document.getElementById("checkoutForm");
const messageBox = document.getElementById("message");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const orderItemsBox = document.getElementById("orderItems");
const subtotalBox = document.getElementById("subtotal");
const totalBox = document.getElementById("total");

let cart = [];

document.getElementById("year").textContent = new Date().getFullYear();

function showMessage(message, type = "error") {
  messageBox.textContent = message;
  messageBox.className = `message ${type}`;
  messageBox.hidden = false;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES"
  }).format(amount);
}

function getToken() {
  return localStorage.getItem("patapro_token");
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("patapro_cart") || "[]");

    if (!Array.isArray(saved)) {
      throw new Error("Invalid cart format.");
    }

    cart = saved
      .map(item => ({
        productId: Number(item.productId ?? item.id),
        quantity: Number(item.quantity)
      }))
      .filter(item =>
        Number.isSafeInteger(item.productId) &&
        item.productId > 0 &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0
      );

    renderCart();
  } catch (error) {
    console.error("Cart loading failed:", error);
    cart = [];
    renderCart();
    showMessage("Your cart could not be read. Return to the cart page and try again.");
  }
}

function renderCart() {
  if (!cart.length) {
    orderItemsBox.replaceChildren();
    const empty = document.createElement("p");
    empty.textContent = "Your cart is empty.";
    orderItemsBox.appendChild(empty);
    subtotalBox.textContent = formatMoney(0);
    totalBox.textContent = formatMoney(0);
    placeOrderBtn.disabled = true;
    return;
  }

  orderItemsBox.replaceChildren();

  let estimatedSubtotal = 0;

  // Prices displayed here are estimates from the saved cart only.
  // The backend rechecks prices and stock before creating the order.
  let savedCart = [];
  try {
    savedCart = JSON.parse(localStorage.getItem("patapro_cart") || "[]");
  } catch (_) {}

  for (const item of cart) {
    const saved = savedCart.find(entry =>
      Number(entry.productId ?? entry.id) === item.productId
    );

    const name = String(saved?.name || `Product #${item.productId}`);
    const price = Number(saved?.price || 0);
    const lineTotal = Number.isFinite(price) && price >= 0
      ? price * item.quantity
      : 0;

    estimatedSubtotal += lineTotal;

    const row = document.createElement("div");
    row.className = "order-item";

    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = name;

    const quantity = document.createElement("span");
    quantity.textContent = ` × ${item.quantity}`;

    details.append(title, quantity);

    const amount = document.createElement("strong");
    amount.textContent = formatMoney(lineTotal);

    row.append(details, amount);
    orderItemsBox.appendChild(row);
  }

  subtotalBox.textContent = formatMoney(estimatedSubtotal);
  totalBox.textContent = formatMoney(estimatedSubtotal);
  placeOrderBtn.disabled = false;
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const token = getToken();

  if (!token) {
    showMessage("Please log in before placing an order.");
    window.location.href =
      `login.html?redirect=${encodeURIComponent("checkout.html")}`;
    return;
  }

  if (!cart.length) {
    showMessage("Your cart is empty.");
    return;
  }

  const data = new FormData(form);
  const payload = {
    items: cart.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    })),
    fullName: String(data.get("fullName") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    county: String(data.get("county") || "").trim(),
    town: String(data.get("town") || "").trim(),
    address: String(data.get("address") || "").trim(),
    notes: String(data.get("notes") || "").trim(),
    paymentMethod: String(data.get("paymentMethod") || "cash_on_delivery")
  };

  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = "Placing order…";

  try {
    const response = await fetch(`${API_URL}/product-orders/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
      }

      throw new Error(result.message || "Unable to place your order.");
    }

    localStorage.removeItem("patapro_cart");

    showMessage(
      `${result.message || "Order placed!"} Order #${result.order.id}.`,
      "success"
    );

    form.reset();
    cart = [];
    renderCart();
    placeOrderBtn.textContent = "Order placed";

    // A dedicated confirmation page can be added next.
    orderItemsBox.textContent = `Order #${result.order.id} created successfully.`;
  } catch (error) {
    showMessage(error.message || "An unexpected error occurred.");
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = "Place order";
  }
});

loadCart();
