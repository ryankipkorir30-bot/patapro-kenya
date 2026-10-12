"use strict";

const API_URL = `${window.PATAPRO_API_BASE || "/api"}/product-orders`;
const TOKEN_KEY = "patapro_token";
const params = new URLSearchParams(window.location.search);
const requestedOrderId = params.get("orderId");

const messageBox = document.getElementById("message");
const orderContent = document.getElementById("orderContent");

document.getElementById("year").textContent =
  new Date().getFullYear();

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

  if (!Number.isFinite(amount)) return "Amount unavailable";

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2
  }).format(amount);
}

function showMessage(text, isError = false) {
  messageBox.textContent = text;
  messageBox.className = isError ? "message error" : "message";
  messageBox.hidden = false;
}

function dateLabel(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function extractOrder(data) {
  if (data?.order) return data.order;
  if (data?.data?.order) return data.data.order;
  if (data?.data && !Array.isArray(data.data)) return data.data;

  return data;
}

function renderOrder(order) {
  const id = firstDefined(order.id, order.order_id, order.orderId);
  const status = String(
    firstDefined(order.status, order.order_status, "pending")
  ).toLowerCase().replace(/[\s-]+/g, "_");

  const total = firstDefined(
    order.total_amount,
    order.totalAmount,
    order.total,
    order.grand_total,
    order.grandTotal
  );

  const customer = order.customer || order.customer_details || {};
  const delivery = order.deliveryAddress ||
    order.delivery_address ||
    order.shipping_address ||
    {};

  const items = firstDefined(order.items, order.order_items, order.products, []);

  document.getElementById("orderReference").textContent = `PP-${id}`;
  document.getElementById("orderDate").textContent = dateLabel(
    firstDefined(order.created_at, order.createdAt, order.order_date)
  );

  const statusElement = document.getElementById("orderStatus");
  statusElement.textContent = status.replace(/_/g, " ");
  statusElement.className = `status ${status}`;

  document.getElementById("orderTotal").textContent = money(total);

  document.getElementById("customerName").textContent = firstDefined(
    customer.fullName,
    customer.full_name,
    order.customer_name,
    order.full_name,
    "Not provided"
  );

  document.getElementById("customerPhone").textContent = firstDefined(
    customer.phone,
    order.phone,
    order.customer_phone,
    "Not provided"
  );

  document.getElementById("deliveryCounty").textContent = firstDefined(
    delivery.county,
    order.county,
    "Not provided"
  );

  document.getElementById("deliveryTown").textContent = firstDefined(
    delivery.town,
    order.town,
    "Not provided"
  );

  document.getElementById("deliveryAddress").textContent = firstDefined(
    delivery.address,
    order.delivery_address,
    order.shipping_address,
    "Not provided"
  );

  document.getElementById("paymentMethod").textContent = String(
    firstDefined(order.payment_method, order.paymentMethod, "Not specified")
  ).replace(/_/g, " ");

  const itemsContainer = document.getElementById("orderItems");

  if (!Array.isArray(items) || items.length === 0) {
    itemsContainer.innerHTML =
      '<p class="muted">No item details were returned by the API.</p>';
  } else {
    itemsContainer.innerHTML = items.map((item) => {
      const name = firstDefined(
        item.product_name,
        item.productName,
        item.name,
        item.product?.name,
        "Product"
      );

      const quantity = Number(firstDefined(item.quantity, item.qty, 1));

      const unitPrice = Number(firstDefined(
        item.unit_price,
        item.unitPrice,
        item.price,
        item.product?.price,
        0
      ));

      const lineTotal = firstDefined(
        item.line_total,
        item.lineTotal,
        item.subtotal,
        unitPrice * quantity
      );

      return `
        <div class="order-item">
          <div>
            <div class="item-name">${escapeHtml(name)}</div>
            <div class="item-meta">
              Quantity: ${Number.isFinite(quantity) ? quantity : "—"}
              · Unit price: ${escapeHtml(money(unitPrice))}
            </div>
          </div>
          <div class="item-price">${escapeHtml(money(lineTotal))}</div>
        </div>
      `;
    }).join("");
  }

  messageBox.hidden = true;
  orderContent.hidden = false;
}

async function loadOrder() {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    window.location.href =
      `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    return;
  }

  if (!requestedOrderId || requestedOrderId.length > 100) {
    showMessage("A valid order reference is required.", true);
    return;
  }

  // Restrict the reference to common numeric or UUID-like IDs.
  if (!/^[a-zA-Z0-9_-]+$/.test(requestedOrderId)) {
    showMessage("The order reference contains invalid characters.", true);
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/${encodeURIComponent(requestedOrderId)}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      }
    );

    const body = await response.text();
    let data = {};

    try {
      data = body ? JSON.parse(body) : {};
    } catch {
      throw new Error("The server returned a non-JSON response.");
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
      }

      if (response.status === 403 || response.status === 404) {
        throw new Error(
          "This order was not found or you do not have permission to view it."
        );
      }

      throw new Error(
        data.message || data.error || `Could not load order (${response.status}).`
      );
    }

    const order = extractOrder(data);

    if (!order || typeof order !== "object" || Array.isArray(order)) {
      throw new Error("The server returned an unexpected order format.");
    }

    const returnedId = firstDefined(order.id, order.order_id, order.orderId);

    if (returnedId === undefined || returnedId === null) {
      throw new Error("The order response does not contain an order ID.");
    }

    renderOrder(order);
  } catch (error) {
    showMessage(
      `${error.message} The endpoint must match your existing order routes.`,
      true
    );
  }
}

loadOrder();
