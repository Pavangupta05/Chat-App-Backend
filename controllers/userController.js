/**
 * controllers/userController.js
 * Lists all users except the currently authenticated user.
 *
 * Routes consumed:
 *   GET /api/users  → getAllUsers  (protected)
 *
 * The frontend (userService.js) calls GET /api/users with a Bearer token
 * to populate the "New Chat" user picker.
 */

const User = require("../models/User");

/**
 * getAllUsers
 * Returns every registered user except the caller, without passwords.
 * Supports an optional ?search= query-string for name/email filtering.
 */
const getAllUsers = async (req, res) => {
  try {
    const searchTerm = req.query.search?.trim();

    // Build a query that always excludes the logged-in user
    const query = { _id: { $ne: req.user._id } };

    // If a search term is provided, do a case-insensitive regex on name or email
    if (searchTerm) {
      query.$or = [
        { username: { $regex: searchTerm, $options: "i" } },
        { email:    { $regex: searchTerm, $options: "i" } },
      ];
    }

    const users = await User.find(query).select("-password").sort({ username: 1 });

    // Map to a shape the frontend expects (id not _id)
    const result = users.map((u) => u.toSafeObject());

    return res.status(200).json(result);
  } catch (error) {
    console.error("[getAllUsers] Error:", error.message);
    return res.status(500).json({ error: "Server error while fetching users." });
  }
};

module.exports = { getAllUsers };
