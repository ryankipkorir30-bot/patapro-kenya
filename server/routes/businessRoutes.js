const express = require("express");
const router = express.Router();

const businessController = require("../controllers/businessController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

// Public routes
router.get("/", businessController.getBusinesses);

// IMPORTANT: /my must come before /:id
router.get("/my", authMiddleware, businessController.getMyBusiness);

// Get one business
router.get("/:id", businessController.getBusiness);

// Create a business
router.post("/", authMiddleware, businessController.createBusiness);

// Update a business
router.put("/:id", authMiddleware, businessController.updateBusiness);

// Deactivate a business
router.delete("/:id", authMiddleware, businessController.deactivateBusiness);

// Upload a business photo
router.post(
  "/:id/photo",
  authMiddleware,
  upload.single("businessPhoto"),
  businessController.uploadBusinessPhoto
);

module.exports = router;