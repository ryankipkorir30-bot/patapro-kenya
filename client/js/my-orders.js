"use strict";

const API_URL = `${window.PATAPRO_API_BASE || "/api"}/product-orders`;
const TOKEN_KEY = "patapro_token";

const messageBox = document.getElementById("message");
const ordersList = document.getElementById("ordersList");
const statusFilter = document.getElementById("statusFilter");

let allOrders = [];

document.getElementById("year").textContent =
  new Date().getFullYear();

function showMessage(text, type = "") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`.trim();
  messageBox.hidden = false;
}

function hideMessage() {
  messageBox.hidden = true;
  messageBox.textContent = "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function money(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Amount unavailable";
  }

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2
  }).format(amount);
}

function normaliseStatus(status) {
  return String(status || "pending")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function statusLabel(status) {
  return normaliseStatus(status).replace(/_/g, " ");
}

function dateLabel(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function orderId(order) {
  return order.id ?? order.order_id ?? order.orderId ?? "";
}

function orderTotal(order) {
  return (
    order.total_amount ??
    order.totalAmount ??
    order.total ??
    order.grand_total ??
    order.grandTotal ??
    order.subtotal
  );
}

function orderStatus(order) {
  return order.status ?? order.order_status ?? "pending";
}

function orderDate(order) {
  return (
    order.created_at ??
    order.createdAt ??
    order.order_date ??
    order.orderDate
  );
}

function extractOrders(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orders)) return data.orders;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.data?.orders)) return data.data.orders;

  return null;
}

function updateStats(orders) {
  document.getElementById("totalOrders").textContent = orders.length;

  document.getElementById("processingOrders").textContent =
    orders.filter((order) => {
      const status = normaliseStatus(orderStatus(order));
      return ["processing", "confirmed", "shipped", "in_transit"].includes(status);
    }).length;

  document.getElementById("completedOrders").textContent =
    orders.filter((order) =>
      ["completed", "delivered"].includes(normaliseStatus(orderStatus(order)))
    ).length;
}

function renderOrders() {
  const selectedStatus = statusFilter.value;

  const orders = allOrders.filter((order) => {
    if (selectedStatus === "all") return true;

    const status = normaliseStatus(orderStatus(order));

    if (selectedStatus === "processing") {
      return ["processing", "confirmed", "shipped", "in_transit"].includes(status);
    }

    if (selectedStatus === "completed") {
      return ["completed", "delivered"].includes(status);
    }

    return status === selectedStatus;
  });

  if (!orders.length) {
    ordersList.innerHTML = `
      <div class="empty-state">
        <div class="emoji">📦</div>
        <h3>${allOrders.length ? "No matching orders" : "No orders yet"}</h3>
        <p>
          ${allOrders.length
            ? "Try selecting a different status."
            : "Your purchases will appear here after you place an order."}
        </p>
        <a href="marketplace.html">Explore the marketplace →</a>
      </div>
    `;
    return;
  }

  ordersList.innerHTML = orders.map((order) => {
    const id = orderId(order);
    const status = normaliseStatus(orderStatus(order));
    const label = statusLabel(orderStatus(order));
    const total = orderTotal(order);

    return `
      <article class="order-card">
        <div class="order-top">
          <div>
            <div class="order-reference">
              Order ${escapeHtml(id || "Reference unavailable")}
            </div>
            <div class="order-date">${escapeHtml(dateLabel(orderDate(order)))}</div>
          </div>

          <span class="status ${escapeHtml(status)}">
            ${escapeHtml(label)}
          </span>
        </div>

        <div class="order-bottom">
          <div class="order-total">
            ${escapeHtml(money(total))}
            <span>Order total</span>
          </div>

          ${id ? `
            <a class="order-detail-link"
               href="order-details.html?orderId=${encodeURIComponent(id)}">
              View details →
            </a>
          ` : ""}
        </div>
      </article>
    `;
  }).join("");
}

async function loadOrders() {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    window.location.href =
      `login.html?redirect=${encodeURIComponent("my-orders.html")}`;
    return;
  }

  showMessage("Loading your orders…");

  try {
    // Confirm this path against the existing cart/order routes.
    const response = await fetch(`${API_URL}/my`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    const rawBody = await response.text();
    let data = {};

    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      throw new Error(
        "The server returned a non-JSON response. Check the API route."
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Your login session has expired. Please log in again.");
      }

      throw new Error(
        data.message || data.error ||
        `Could not load orders (${response.status}).`
      );
    }

    const orders = extractOrders(data);

    if (!orders) {
      throw new Error(
        "The order API response format needs to be matched to this page."
      );
    }

    allOrders = orders;
    updateStats(allOrders);
    hideMessage();
    renderOrders();
  } catch (error) {
    showMessage(
      `${error.message} Your existing backend routes will be connected during integration.`,
      "error"
    );

    ordersList.innerHTML = "";
    document.getElementById("totalOrders").textContent = "—";
    document.getElementById("processingOrders").textContent = "—";
    document.getElementById("completedOrders").textContent = "—";
  }
}

statusFilter.addEventListener("change", renderOrders);

loadOrders();
