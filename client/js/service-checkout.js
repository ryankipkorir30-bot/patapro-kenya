(() => {
  "use strict";

  const API_URL = `${(window.PATAPRO_API_BASE || "/api").replace(/\/+$/, "")}`;

  const $ = id => document.getElementById(id);
  const form = $("serviceCheckoutForm");
  const messageBox = $("message");
  const submitButton = $("placeServiceOrderBtn");
  const itemsBox = $("serviceOrderItems");
  const subtotalBox = $("serviceSubtotal");
  const totalBox = $("serviceTotal");

  let cartItems = [];
  let loading = true;
  let submitting = false;

  if ($("year")) {
    $("year").textContent = new Date().getFullYear();
  }

  function getToken() {
    return localStorage.getItem("patapro_token");
  }

  function money(value) {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES"
    }).format(Number(value) || 0);
  }

  function showMessage(text, type = "error") {
    messageBox.textContent = text;
    messageBox.className = `message ${type}`;
    messageBox.hidden = false;
  }

  function setButtonState() {
    submitButton.disabled =
      loading || submitting || cartItems.length === 0;
  }

  function renderCart() {
    itemsBox.replaceChildren();

    if (!cartItems.length) {
      const empty = document.createElement("p");
      empty.textContent = loading
        ? "Loading your services…"
        : "Your service cart is empty. Return to the cart and add a service.";
      itemsBox.appendChild(empty);

      subtotalBox.textContent = money(0);
      totalBox.textContent = money(0);
      setButtonState();
      return;
    }

    let subtotal = 0;

    for (const item of cartItems) {
      const quantity = Number(item.quantity);
      const price = Number(item.price);
      const lineTotal = price * quantity;

      subtotal += lineTotal;

      const row = document.createElement("div");
      row.className = "order-item";

      const details = document.createElement("div");

      const name = document.createElement("strong");
      name.textContent = item.service_name || `Service #${item.service_id}`;

      const business = document.createElement("p");
      business.textContent = item.business_name || "Service provider";

      const quantityText = document.createElement("span");
      quantityText.textContent = `Quantity: ${quantity}`;

      details.append(name, business, quantityText);

      const amount = document.createElement("strong");
      amount.textContent = money(lineTotal);

      row.append(details, amount);
      itemsBox.appendChild(row);
    }

    subtotalBox.textContent = money(subtotal);
    totalBox.textContent = money(subtotal);
    setButtonState();
  }

  async function loadCart() {
    const token = getToken();

    if (!token) {
      loading = false;
      renderCart();
      showMessage("Please log in to view your service cart.");
      window.location.href =
        `login.html?redirect=${encodeURIComponent("service-checkout.html")}`;
      return;
    }

    try {
      const response = await fetch(`${API_URL}/cart`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session has expired. Please log in again.");
        }

        throw new Error(result.message || "Could not load your service cart.");
      }

      // The API may return the cart array directly or in result.items.
      const items = Array.isArray(result)
        ? result
        : Array.isArray(result.items)
          ? result.items
          : Array.isArray(result.cart)
            ? result.cart
            : null;

      if (!items) {
        throw new Error("The cart response had an unexpected format.");
      }

      cartItems = items.filter(item =>
        Number.isSafeInteger(Number(item.service_id)) &&
        Number(item.service_id) > 0 &&
        Number.isSafeInteger(Number(item.quantity)) &&
        Number(item.quantity) > 0 &&
        item.price !== null &&
        Number.isFinite(Number(item.price)) &&
        Number(item.price) >= 0 &&
        item.price_type === "fixed"
      );

      if (items.length && !cartItems.length) {
        showMessage(
          "Your cart contains services that require a quote or have invalid prices. Please return to the cart to review them."
        );
      }

      loading = false;
      renderCart();
    } catch (error) {
      loading = false;
      cartItems = [];
      renderCart();
      showMessage(error.message || "Could not load your service cart.");
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (submitting || loading || !cartItems.length) {
      return;
    }

    const token = getToken();

    if (!token) {
      showMessage("Please log in before confirming your service order.");
      window.location.href =
        `login.html?redirect=${encodeURIComponent("service-checkout.html")}`;
      return;
    }

    const deliveryLocation = $("deliveryLocation").value.trim();
    const customerNote = $("customerNote").value.trim();

    if (!deliveryLocation) {
      showMessage("Please enter the service location.");
      $("deliveryLocation").focus();
      return;
    }

    if (deliveryLocation.length > 255 || customerNote.length > 2000) {
      showMessage("Please shorten the location or additional instructions.");
      return;
    }

    submitting = true;
    submitButton.textContent = "Submitting order…";
    setButtonState();

    try {
      const response = await fetch(`${API_URL}/orders/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          deliveryLocation,
          customerNote
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session has expired. Please log in again.");
        }

        throw new Error(result.message || "Could not submit your service order.");
      }

      const order = result.order || {};
      const orderId = order.id;

      if (!orderId) {
        throw new Error(
          "The server responded without an order number. Check My Orders before trying again."
        );
      }

      // The backend creates the order and clears the database-backed cart.
      cartItems = [];
      renderCart();
      form.reset();

      showMessage(
        `Service order #${orderId} was created successfully. Payment has not been processed.`,
        "success"
      );

      submitButton.textContent = "Order submitted";
      submitButton.disabled = true;

      const confirmation = document.createElement("p");
      confirmation.textContent =
        `Order total: ${money(order.total_amount)}. You can review your order in My Orders.`;
      itemsBox.replaceChildren(confirmation);

      const ordersLink = document.createElement("a");
      ordersLink.href = "my-orders.html";
      ordersLink.className = "edit-cart";
      ordersLink.textContent = "View my orders";
      itemsBox.appendChild(ordersLink);
    } catch (error) {
      showMessage(error.message || "An unexpected error occurred.");
      submitting = false;
      submitButton.textContent = "Confirm service order";
      setButtonState();
    }
  });

  loadCart();
})();
