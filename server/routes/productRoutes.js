const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");

// Update this import to match the authentication middleware
// already used by your existing protected routes.
const authMiddleware = require("../middleware/authMiddleware");

// Public marketplace endpoints
router.get("/", productController.getProducts);

// Keep this route above /:id to avoid treating "seller" as an ID.
router.get(
  "/seller/mine",
  authMiddleware,
  productController.getMyProducts
);

router.get("/:id", productController.getProduct);

// Authenticated seller endpoints
router.post(
  "/",
  authMiddleware,
  productController.createProduct
);

router.put(
  "/:id",
  authMiddleware,
  productController.updateProduct
);

router.patch(
  "/:id/archive",
  authMiddleware,
  productController.archiveProduct
);

module.exports = router;
