/**
 * routes/authRoutes.js
 * Authentication routes — no JWT required.
 *
 *   POST /api/auth/register               → register a new user
 *   POST /api/auth/login                  → login and receive a JWT
 *   POST /api/auth/forgot-password        → request a password reset link
 *   POST /api/auth/reset-password/:token  → submit a new password
 */

const express = require("express");
const router  = express.Router();
const { registerUser, loginUser, googleLogin } = require("../controllers/authController");
const { forgotPassword, resetPassword } = require("../controllers/passwordResetController");

// ── Existing routes (unchanged) ────────────────────────────────────────────────
router.post("/register", registerUser);
router.post("/login",    loginUser);
router.post("/google",   googleLogin);

// ── Password reset routes (no JWT needed) ─────────────────────────────────────
router.post("/forgot-password",        forgotPassword);
router.post("/reset-password/:token",  resetPassword);

module.exports = router;
