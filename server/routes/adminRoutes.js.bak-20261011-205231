const express = require("express");

const router = express.Router();

const {
  getOverview,
  getUsers,
  getUserDetails,
  getBusinesses,
  getVerificationRequests,
  getQuotes,
  updateQuoteStatus,
  getFeaturedListings,
  getPayments,
  updateUserStatus,
  updateBusinessStatus,
  getServices,
  updateServiceStatus
} = require("../controllers/adminController");

const authMiddleware = require("../middleware/authMiddleware");

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required"
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required"
    });
  }

  next();
};

// Protect all admin routes
router.use(authMiddleware, adminOnly);

// Dashboard overview
router.get("/overview", getOverview);

// Users
router.get("/users", getUsers);
router.get("/users/:id", getUserDetails);
router.put("/users/:id/status", updateUserStatus);
// Businesses
router.get("/businesses", getBusinesses);
router.put("/businesses/:id/status", updateBusinessStatus);

// Verification requests
router.get("/verifications", getVerificationRequests);

// Quotes
router.get("/services", getServices);
router.put("/services/:id/status", updateServiceStatus);

router.get("/quotes", getQuotes);
router.put("/quotes/:id/status", updateQuoteStatus);

// Featured listings
router.get("/featured", getFeaturedListings);

// Payments
router.get("/payments", getPayments);

module.exports = router;

