/**
 * middleware/authMiddleware.js
 * Protects API routes by verifying the Bearer JWT token.
 *
 * Usage:
 *   const protect = require("../middleware/authMiddleware");
 *   router.get("/protected-route", protect, controller);
 *
 * On success  → attaches req.user (the full Mongoose User document, minus password)
 * On failure  → responds with 401 Unauthorized
 */

const jwt  = require("jsonwebtoken");
const User = require("../models/User");

/**
 * protect — Express middleware that validates a JWT and attaches the
 *           corresponding User document to req.user.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Extract the token from the Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized — no token provided." });
  }

  try {
    // 2. Verify the token signature and decode the payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Load the user from DB (exclude the hashed password)
    req.user = await User.findById(decoded.id).select("-password").lean();

    if (!req.user) {
      return res.status(401).json({ error: "Not authorized — user not found." });
    }

    next();
  } catch (error) {
    console.error("[authMiddleware] Token verification failed:", error.message);
    return res.status(401).json({ error: "Not authorized — invalid or expired token." });
  }
};

module.exports = protect;
