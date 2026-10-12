const productOrderModel = require("../models/productOrderModel");

exports.checkout = async (req, res) => {
  if (!req.user || req.user.role !== "customer") {
    return res.status(403).json({
      success: false,
      message: "Only customer accounts can place product orders."
    });
  }

  try {
    const {
      items,
      fullName,
      phone,
      email,
      county,
      town,
      address,
      notes,
      paymentMethod
    } = req.body;

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty or contains too many items."
      });
    }

    const requiredFields = {
      fullName,
      phone,
      county,
      town,
      address
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (typeof value !== "string" || !value.trim()) {
        return res.status(400).json({
          success: false,
          message: `${field} is required.`
        });
      }
    }

    if (
      fullName.trim().length > 120 ||
      phone.trim().length > 20 ||
      (email && (typeof email !== "string" || email.length > 160)) ||
      county.trim().length > 100 ||
      town.trim().length > 100 ||
      address.trim().length > 500 ||
      (notes && (typeof notes !== "string" || notes.length > 1000))
    ) {
      return res.status(400).json({
        success: false,
        message: "One or more checkout fields exceed the allowed length."
      });
    }

    if (!/^[+\d\s()-]{7,20}$/.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid phone number."
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address."
      });
    }

    if (!["cash_on_delivery", "mpesa"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Choose a supported payment method."
      });
    }

    const details = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : null,
      county: county.trim(),
      town: town.trim(),
      address: address.trim(),
      notes: notes ? notes.trim() : null,
      paymentMethod
    };

    const order = await productOrderModel.createProductOrder(
      req.user.id,
      details,
      items
    );

    return res.status(201).json({
      success: true,
      message: paymentMethod === "mpesa"
        ? "Order created. M-Pesa payment is still pending."
        : "Order placed successfully.",
      order
    });
  } catch (error) {
    console.error("Product checkout error:", error.message);

    const clientError =
      /unavailable|insufficient stock|quantity|invalid|duplicate|stock changed/i
        .test(error.message);

    return res.status(clientError ? 400 : 500).json({
      success: false,
      message: clientError
        ? error.message
        : "Unable to place your order. Please try again."
    });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await productOrderModel.listCustomerOrders(req.user.id);

    return res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error("Load product orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load your orders."
    });
  }
};


exports.getMyOrder = async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID."
      });
    }

    const order = await productOrderModel.getCustomerOrder(
      req.user.id,
      orderId
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    return res.json({ success: true, order });
  } catch (error) {
    console.error("Load product order details error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load order details."
    });
  }
};
