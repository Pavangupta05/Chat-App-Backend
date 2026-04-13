/**
 * controllers/userController.js
 * Manages user operations including listing, updating, and deletion.
 *
 * Routes consumed:
 *   GET /api/users          → getAllUsers  (protected)
 *   PUT /api/users/profile  → updateProfile (protected)
 *   DELETE /api/users       → deleteUser    (protected)
 *
 * The frontend (userService.js) calls GET /api/users with a Bearer token
 * to populate the "New Chat" user picker.
 */

const User = require("../models/User");
const Chat = require("../models/Chat");
const Message = require("../models/Message");

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
      // Escape special regex chars to prevent ReDoS attacks
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { username: { $regex: escaped, $options: "i" } },
        { email:    { $regex: escaped, $options: "i" } },
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

/* ── Delete the authenticated user's account ────────────────────────────────── */

/**
 * deleteUser
 * Deletes the authenticated user's account and all associated data:
 * • Removes user from all chats they're in
 * • Deletes chats where user was the only/both participant
 * • Deletes all messages sent by the user
 * • Deletes the user account itself
 */
const deleteUser = async (req, res) => {
  try {
    const userId = req.user._id;

    // Step 1: Find all chats user is part of
    const chats = await Chat.find({ participants: { $in: [userId] } });
    const chatIdsToDelete = [];

    // Step 2: For each chat, remove user or delete entire chat if they were the only participant
    for (const chat of chats) {
      const remainingParticipants = chat.participants.filter(
        (p) => p.toString() !== userId.toString()
      );

      if (remainingParticipants.length === 0) {
        // No other participants — queue entire chat for deletion
        chatIdsToDelete.push(chat._id);
        await Chat.findByIdAndDelete(chat._id);
      } else {
        // Peer chat — just remove this user from participants
        await Chat.findByIdAndUpdate(chat._id, {
          participants: remainingParticipants,
        });
      }
    }

    // Step 3: Delete ALL messages in orphaned chats (sent by anyone in those chats)
    if (chatIdsToDelete.length > 0) {
      await Message.deleteMany({ chatId: { $in: chatIdsToDelete } });
    }

    // Step 4: Delete only this user's own messages in remaining (peer) chats
    await Message.deleteMany({ senderId: userId });

    // Step 5: Delete the user account
    await User.findByIdAndDelete(userId);

    console.log("[deleteUser] User deleted successfully:", userId);
    return res.status(200).json({ message: "User account deleted successfully." });
  } catch (error) {
    console.error("[deleteUser] Error:", error.message);
    return res.status(500).json({ error: "Server error while deleting user account." });
  }
};

module.exports = { getAllUsers, updateProfile, deleteUser };
