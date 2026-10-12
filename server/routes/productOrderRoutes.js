const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const productOrderController = require("../controllers/productOrderController");

// Every product-order endpoint requires authentication.
router.post("/checkout", authMiddleware, productOrderController.checkout);
router.get("/my", authMiddleware, productOrderController.getMyOrders);

module.exports = router;
