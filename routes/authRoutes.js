/**
 * routes/authRoutes.js
 * Authentication routes — no JWT required.
 *
 *   POST /api/auth/register  → register a new user
 *   POST /api/auth/login     → login and receive a JWT
 */

const express    = require("express");
const router     = express.Router();
const { registerUser, loginUser } = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login",    loginUser);

module.exports = router;
