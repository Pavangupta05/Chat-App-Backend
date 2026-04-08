/**
 * controllers/authController.js
 * Handles user registration and login.
 *
 * Routes consumed:
 *   POST /api/auth/register  → registerUser
 *   POST /api/auth/login     → loginUser
 */

const jwt  = require("jsonwebtoken");
const User = require("../models/User");

/* ── Helpers ───────────────────────────────────────────────────────────────── */

/**
 * generateToken — signs a JWT containing the user's MongoDB _id.
 * Expiry is set to 30 days.
 * @param {string} id - Mongoose _id string
 * @returns {string} signed JWT
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

/* ── Register ───────────────────────────────────────────────────────────────── */

/**
 * registerUser
 * Body: { username, email, password }
 *
 * • Validates required fields
 * • Checks for duplicate email
 * • Creates the user (password hashed via pre-save hook in the model)
 * • Returns the safe user object (no password exposed)
 */
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const sanitizedEmail = email?.toLowerCase().trim();

    console.log(`[AUTH] Registering: email="${sanitizedEmail}", passLen=${password?.length}`);

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Please provide username, email, and password." });
    }

    // Check for duplicate email
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      console.warn(`[AUTH] Registration failed: email "${sanitizedEmail}" already exists.`);
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    // Create user (password hashing handled by pre-save middleware)
    const user = await User.create({
      username: username.trim(),
      email:    sanitizedEmail,
      password,
    });

    console.log(`[AUTH] User created successfully: ${user._id}`);

    return res.status(201).json({
      message: "Account created successfully. You can now log in.",
      user:    user.toSafeObject(),
    });
  } catch (error) {
    console.error("[registerUser] Error:", error.message);
    return res.status(500).json({ error: "Server error during registration." });
  }
};

/* ── Login ──────────────────────────────────────────────────────────────────── */

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const sanitizedEmail = email?.toLowerCase().trim();

    console.log(`[AUTH] Login attempt: email="${sanitizedEmail}", passLen=${password?.length}`);

    if (!email || !password) {
      return res.status(400).json({ error: "Please provide email and password." });
    }

    // Find user by email
    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
      console.warn(`[AUTH] Login failed: No user found with email "${sanitizedEmail}"`);
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Compare passwords
    const isMatch = await user.matchPassword(password);
    console.log(`[AUTH] Password match for "${sanitizedEmail}": ${isMatch}`);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user._id.toString());

    return res.status(200).json({
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("[loginUser] Error:", error.message);
    return res.status(500).json({ error: "Server error during login." });
  }
};

module.exports = { registerUser, loginUser };
