const express = require("express");
const router = express.Router();

const {
  createFeaturedRequest,
  getFeaturedRequests,
  approveFeatured,
  rejectFeatured
} = require("../controllers/featuredController");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createFeaturedRequest);

router.get("/", authMiddleware, getFeaturedRequests);

router.put("/:id/approve", authMiddleware, approveFeatured);

router.put("/:id/reject", authMiddleware, rejectFeatured);

module.exports = router;
