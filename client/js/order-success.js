"use strict";

const params = new URLSearchParams(window.location.search);
const orderId = params.get("orderId");

const referenceElement = document.getElementById("orderReference");
const copyButton = document.getElementById("copyReference");
const pageMessage = document.getElementById("pageMessage");

document.getElementById("year").textContent =
  new Date().getFullYear();

function showPageMessage(message) {
  pageMessage.textContent = message;
  pageMessage.hidden = false;
}

if (!orderId || orderId.length > 100) {
  referenceElement.textContent = "Reference unavailable";
  copyButton.disabled = true;
  showPageMessage(
    "No order reference was provided. Check your order history or contact support."
  );
} else {
  referenceElement.textContent = `PP-${orderId}`;
}

copyButton.addEventListener("click", async () => {
  if (!orderId) return;

  const reference = `PP-${orderId}`;

  try {
    await navigator.clipboard.writeText(reference);
    showPageMessage("Order reference copied.");
  } catch {
    showPageMessage(
      `Your order reference is ${reference}. Select and copy it manually.`
    );
  }
});
