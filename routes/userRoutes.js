/**
 * routes/userRoutes.js
 * User routes — all protected by JWT middleware.
 *
 *   GET /api/users          → list all users (supports ?search= filter)
 *   PUT /api/users/profile  → update the logged-in user's profile
 */

const express  = require("express");
const router   = express.Router();
const protect  = require("../middleware/authMiddleware");
const { getAllUsers, updateProfile } = require("../controllers/userController");

router.get("/",        protect, getAllUsers);
router.put("/profile", protect, updateProfile);

module.exports = router;
