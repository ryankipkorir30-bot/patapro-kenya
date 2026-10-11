const cartOrderModel = require("../models/cartOrderModel");

function getCustomerId(req, res) {
  const customerId = Number(req.user?.id);

  if (!Number.isSafeInteger(customerId) || customerId <= 0) {
    res.status(401).json({
      success: false,
      message: "Please log in to continue."
    });
    return null;
  }

  if (!["customer"].includes(req.user?.role)) {
    res.status(403).json({
      success: false,
      message: "Only customer accounts can use the shopping cart."
    });
    return null;
  }

  return customerId;
}

function handleError(res, error) {
  console.error("Cart/order error:", error.message);

  const clientErrors = [
    "Service not found or unavailable.",
    "Your cart is empty."
  ];

  if (
    clientErrors.includes(error.message) ||
    error.message.includes("requires a quote instead of checkout")
  ) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  return res.status(500).json({
    success: false,
    message: "Something went wrong while processing your request."
  });
}

exports.getCart = async (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  try {
    const items = await cartOrderModel.getCart(customerId);

    const total = items.reduce(
      (sum, item) =>
        sum + Number(item.price || 0) * Number(item.quantity),
      0
    );

    res.json({
      success: true,
      items,
      total: total.toFixed(2)
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.addToCart = async (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  const serviceId = Number(req.body.serviceId);
  const quantity = Number(req.body.quantity ?? 1);

  if (
    !Number.isSafeInteger(serviceId) ||
    serviceId <= 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid service ID and quantity from 1 to 100."
    });
  }

  try {
    const item = await cartOrderModel.addToCart(
      customerId,
      serviceId,
      quantity
    );

    res.status(201).json({
      success: true,
      message: "Service added to cart.",
      item
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateCartQuantity = async (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  const serviceId = Number(req.params.serviceId);
  const quantity = Number(req.body.quantity);

  if (
    !Number.isSafeInteger(serviceId) ||
    serviceId <= 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid service ID and quantity from 1 to 100."
    });
  }

  try {
    const item = await cartOrderModel.updateCartQuantity(
      customerId,
      serviceId,
      quantity
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found."
      });
    }

    res.json({
      success: true,
      message: "Cart quantity updated.",
      item
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.removeFromCart = async (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  const serviceId = Number(req.params.serviceId);

  if (!Number.isSafeInteger(serviceId) || serviceId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid service ID."
    });
  }

  try {
    const removed = await cartOrderModel.removeFromCart(
      customerId,
      serviceId
    );

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found."
      });
    }

    res.json({
      success: true,
      message: "Service removed from cart."
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.checkout = async (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  const deliveryLocation =
    typeof req.body.deliveryLocation === "string"
      ? req.body.deliveryLocation.trim()
      : "";

  const customerNote =
    typeof req.body.customerNote === "string"
      ? req.body.customerNote.trim()
      : "";

  if (deliveryLocation.length > 255 || customerNote.length > 2000) {
    return res.status(400).json({
      success: false,
      message: "Delivery location or note is too long."
    });
  }

  try {
    const order = await cartOrderModel.checkout(
      customerId,
      deliveryLocation,
      customerNote
    );

    res.status(201).json({
      success: true,
      message: "Order created successfully. Payment has not been processed.",
      order
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getMyOrders = async (req, res) => {
  const customerId = getCustomerId(req, res);
  if (!customerId) return;

  try {
    const orders = await cartOrderModel.getCustomerOrders(customerId);

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    handleError(res, error);
  }
};