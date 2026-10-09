const express = require("express");
const { rateLimit } = require("express-rate-limit");

const {
  register,
  login,
googleLogin,
  getMe,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password recovery attempts. Try again later.",
  },
});

router.post("/register", register);

router.post("/login", login);
router.post("/google", googleLogin);
router.get("/me", authMiddleware, getMe);

router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password", passwordResetLimiter, resetPassword);

module.exports = router;
