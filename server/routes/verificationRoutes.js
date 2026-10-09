const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  verificationUpload
} = require("../middleware/verificationUpload");

const {
  createVerificationRequest,
  getVerificationRequests,
  getVerificationDocument,
  approveVerification,
  rejectVerification
} = require("../controllers/verificationController");

// Restrict verification administration to administrators.
function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required."
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required."
    });
  }

  next();
}

// Handle upload errors and return JSON.
function handleUpload(req, res, next) {
  verificationUpload.single("document")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "The document must not exceed 5 MB."
      });
    }

    return res.status(400).json({
      message: error.message || "Document upload failed."
    });
  });
}

// Authenticated users can submit their own verification requests.
router.post(
  "/",
  authMiddleware,
  handleUpload,
  createVerificationRequest
);

// Admin-only verification operations.
router.get(
  "/",
  authMiddleware,
  adminOnly,
  getVerificationRequests
);

router.get(
  "/:id/document",
  authMiddleware,
  adminOnly,
  getVerificationDocument
);

router.put(
  "/:id/approve",
  authMiddleware,
  adminOnly,
  approveVerification
);

router.put(
  "/:id/reject",
  authMiddleware,
  adminOnly,
  rejectVerification
);

module.exports = router;
