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

    res.status(201).json({
      success: true,
      message: "Quote request sent successfully.",
      quote
    });
  } catch (error) {
    console.error("Create quote error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create quote.",
      error: error.message
    });
  }
};

exports.getMyQuotes = async (req, res) => {
  try {
    const quotes = await quoteModel.findQuotesByCustomer(req.user.id);

    res.json({
      success: true,
      quotes
    });
  } catch (error) {
    console.error("Get customer quotes error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load your quotes.",
      error: error.message
    });
  }
};

exports.getBusinessQuotes = async (req, res) => {
  try {
    const businessId = Number(req.params.businessId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Invalid business ID."
      });
    }

    const belongsToUser =
      await quoteModel.businessBelongsToUser(
        businessId,
        req.user.id
      );

    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view these quotes."
      });
    }

    const quotes =
      await quoteModel.findQuotesByBusiness(businessId);

    res.json({
      success: true,
      quotes
    });
  } catch (error) {
    console.error("Get business quotes error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load business quotes.",
      error: error.message
    });
  }
};

exports.updateQuoteStatus = async (req, res) => {
  try {
    const businessId = Number(req.params.businessId);
    const quoteId = Number(req.params.quoteId);
    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "viewed",
      "responded",
      "accepted",
      "rejected",
      "completed",
      "cancelled"
    ];

    if (!businessId || !quoteId) {
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

    const belongsToUser =
      await quoteModel.businessBelongsToUser(
        businessId,
        req.user.id
      );

    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this quote."
      });
    }

    const quote =
      await quoteModel.updateQuoteStatus(
        quoteId,
        businessId,
        status
      );

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found."
      });
    }

    res.json({
      success: true,
      message: "Quote status updated successfully.",
      quote
    });
  } catch (error) {
    console.error("Update quote status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update quote status.",
      error: error.message
    });
  }
};
