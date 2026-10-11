const quoteModel = require("../models/quoteModel");

exports.createQuote = async (req, res) => {
  try {
    const { businessId, serviceId, subject, message, budget } = req.body;
    const customerId = req.user.id;

    if (!businessId || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Business, subject and message are required."
      });
    }

    const quote = await quoteModel.createQuote({
      customerId,
      businessId,
      serviceId: serviceId || null,
      subject,
      message,
      budget: budget || null
    });

    return res.status(201).json({
      success: true,
      message: "Quote request sent successfully.",
      quote
    });
  } catch (error) {
    console.error("Create quote error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create quote."
    });
  }
};

exports.getMyQuotes = async (req, res) => {
  try {
    const quotes = await quoteModel.findQuotesByCustomer(req.user.id);

    return res.json({ success: true, quotes });
  } catch (error) {
    console.error("Get customer quotes error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load your quotes."
    });
  }
};

exports.getBusinessQuotes = async (req, res) => {
  try {
    const businessId = Number(req.params.businessId);

    if (!Number.isSafeInteger(businessId) || businessId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid business ID."
      });
    }

    const belongsToUser = await quoteModel.businessBelongsToUser(
      businessId,
      req.user.id
    );

    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view these quotes."
      });
    }

    const quotes = await quoteModel.findQuotesByBusiness(businessId);

    return res.json({ success: true, quotes });
  } catch (error) {
    console.error("Get business quotes error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load business quotes."
    });
  }
};

exports.updateQuoteStatus = async (req, res) => {
  try {
    const businessId = Number(req.params.businessId);
    const quoteId = Number(req.params.quoteId);
    const { status } = req.body;

    // Only the customer acceptance endpoint should accept a quote.
    const allowedStatuses = [
      "pending",
      "viewed",
      "responded",
      "rejected",
      "completed",
      "cancelled"
    ];

    if (
      !Number.isSafeInteger(businessId) || businessId <= 0 ||
      !Number.isSafeInteger(quoteId) || quoteId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid business or quote ID."
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quote status."
      });
    }

    const belongsToUser = await quoteModel.businessBelongsToUser(
      businessId,
      req.user.id
    );

    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this quote."
      });
    }

    const quote = await quoteModel.updateQuoteStatus(
      quoteId,
      businessId,
      status
    );

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found or status change not allowed."
      });
    }

    return res.json({
      success: true,
      message: "Quote status updated successfully.",
      quote
    });
  } catch (error) {
    console.error("Update quote status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update quote status."
    });
  }
};

exports.proposeQuotePrice = async (req, res) => {
  try {
    const businessId = Number(req.params.businessId);
    const quoteId = Number(req.params.quoteId);
    const agreedPrice = req.body.agreedPrice;

    if (
      !Number.isSafeInteger(businessId) || businessId <= 0 ||
      !Number.isSafeInteger(quoteId) || quoteId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid business or quote ID."
      });
    }

    if (
      agreedPrice === undefined ||
      agreedPrice === null ||
      String(agreedPrice).trim() === "" ||
      !Number.isFinite(Number(agreedPrice)) ||
      Number(agreedPrice) < 0 ||
      Number(agreedPrice) > 9999999999.99
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid, non-negative agreed price."
      });
    }

    const belongsToUser = await quoteModel.businessBelongsToUser(
      businessId,
      req.user.id
    );

    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: "You do not own this business."
      });
    }

    const quote = await quoteModel.proposeQuotePrice(
      quoteId,
      businessId,
      Number(agreedPrice)
    );

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found or no longer available for a price proposal."
      });
    }

    return res.json({
      success: true,
      message: "Price proposal saved successfully.",
      quote
    });
  } catch (error) {
    console.error("Propose quote price error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to propose quote price."
    });
  }
};
// Customer accepts a proposed price and creates an order.
exports.acceptQuote = async (req, res) => {
  try {
    const quoteId = Number(req.params.quoteId);
    const customerId = Number(req.user.id);

    if (
      !Number.isSafeInteger(quoteId) || quoteId <= 0 ||
      !Number.isSafeInteger(customerId) || customerId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid quote or customer ID."
      });
    }

    const result = await quoteModel.acceptQuoteAndCreateOrder(
      quoteId,
      customerId
    );

    return res.status(201).json({
      success: true,
      message: "Quote accepted and order created successfully.",
      order: result.order,
      quote: result.quote
    });
  } catch (error) {
    if (error.message === "QUOTE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Quote not found."
      });
    }

    if (error.message === "QUOTE_NOT_READY") {
      return res.status(409).json({
        success: false,
        message: "This quote has no active proposed price to accept."
      });
    }

    if (error.message === "QUOTE_SERVICE_REQUIRED") {
      return res.status(400).json({
        success: false,
        message: "This quote must be linked to a service before an order can be created."
      });
    }

    if (error.message === "INVALID_AGREED_PRICE") {
      return res.status(400).json({
        success: false,
        message: "The proposed price is invalid."
      });
    }

    console.error("Accept quote error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to accept quote and create order."
    });
  }
};
