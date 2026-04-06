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

/* ── Update the logged-in user's profile ────────────────────────────────────── */

/**
 * updateProfile
 * Body: { username?, profilePic? }
 *
 * Allows the authenticated user to update their display name and avatar URL.
 * Returns the updated safe user object.
 */
const updateProfile = async (req, res) => {
  try {
    const { username, profilePic } = req.body;

    const updates = {};

    if (username !== undefined) {
      const trimmed = String(username).trim();
      if (!trimmed) {
        return res.status(400).json({ error: "Username cannot be empty." });
      }
      updates.username = trimmed;
    }

    if (profilePic !== undefined) {
      updates.profilePic = String(profilePic).trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json(updated.toSafeObject());
  } catch (error) {
    console.error("[updateProfile] Error:", error.message);
    return res.status(500).json({ error: "Server error while updating profile." });
  }
};

module.exports = { getAllUsers, updateProfile };
