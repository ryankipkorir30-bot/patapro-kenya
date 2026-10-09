const express = require("express");

const router = express.Router();

const {
  createQuote,
  getMyQuotes,
  getBusinessQuotes,
  updateQuoteStatus
} = require("../controllers/quoteController");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createQuote);

router.get("/my", authMiddleware, getMyQuotes);

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

module.exports = router;
