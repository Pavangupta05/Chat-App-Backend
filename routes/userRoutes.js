/**
 * routes/userRoutes.js
 * User routes — all protected by JWT middleware.
 *
 *   GET /api/users          → list all users (supports ?search= filter)
 *   PUT /api/users/profile  → update the logged-in user's profile
 *   DELETE /api/users       → delete the logged-in user's account
 */

const express  = require("express");
const router   = express.Router();
const protect  = require("../middleware/authMiddleware");
const { getAllUsers, updateProfile, deleteUser } = require("../controllers/userController");

router.get("/",        protect, getAllUsers);
router.put("/profile", protect, updateProfile);
router.delete("/",     protect, deleteUser);

module.exports = router;
