const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const cartOrderController = require("../controllers/cartOrderController");

// Shopping cart — customer login required
router.get("/cart", authMiddleware, cartOrderController.getCart);
router.post("/cart", authMiddleware, cartOrderController.addToCart);
router.patch(
  "/cart/:serviceId",
  authMiddleware,
  cartOrderController.updateCartQuantity
);
router.delete(
  "/cart/:serviceId",
  authMiddleware,
  cartOrderController.removeFromCart
);

// Orders — customer login required
router.post(
  "/orders/checkout",
  authMiddleware,
  cartOrderController.checkout
);
router.get(
  "/orders/my",
  authMiddleware,
  cartOrderController.getMyOrders
);

module.exports = router;
