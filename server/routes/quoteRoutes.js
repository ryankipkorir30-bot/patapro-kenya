
const express = require("express");
const router = express.Router();

const {
  createQuote,
  getMyQuotes,
  getBusinessQuotes,
  updateQuoteStatus,
  proposeQuotePrice,
  acceptQuote
} = require("../controllers/quoteController");

const authMiddleware = require("../middleware/authMiddleware");

// Customer quote requests
router.post("/", authMiddleware, createQuote);
router.get("/my", authMiddleware, getMyQuotes);
router.post(
  "/my/:quoteId/accept",
  authMiddleware,
  acceptQuote
);
// Business quote management
router.get(
  "/business/:businessId",
  authMiddleware,
  getBusinessQuotes
);

router.put(
  "/business/:businessId/:quoteId/status",
  authMiddleware,
  updateQuoteStatus
);

router.put(
  "/business/:businessId/:quoteId/price",
  authMiddleware,
  proposeQuotePrice
);

module.exports = router;
