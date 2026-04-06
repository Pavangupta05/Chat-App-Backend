/**
 * controllers/chatController.js
 * Manages one-to-one chat creation and retrieval.
 *
 * Routes consumed:
 *   POST /api/chat       → accessOrCreateChat (create or fetch a DM)
 *   GET  /api/chat       → getUserChats       (all chats for the current user)
 */

const Chat    = require("../models/Chat");
const Message = require("../models/Message");

/* ── Access or create a one-to-one chat ─────────────────────────────────────── */

/**
 * accessOrCreateChat
 * Body: { userId }  — the OTHER user's _id
 *
 * • If a chat already exists between the two users, returns it.
 * • Otherwise creates a new chat and returns it.
 */
const accessOrCreateChat = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required in the request body." });
    }

    // Look for an exact array match in either order to avoid MongoDB $all collapsing bugs
    let chat = await Chat.findOne({
      $or: [
        { participants: [req.user._id, userId] },
        { participants: [userId, req.user._id] },
      ],
    }).populate("participants", "-password");

    if (!chat) {
      // Create a new one-to-one chat
      chat = await Chat.create({
        participants: [req.user._id, userId],
      });
      chat = await Chat.findById(chat._id).populate("participants", "-password");
    }

    return res.status(200).json(chat);
  } catch (error) {
    console.error("[accessOrCreateChat] Error:", error.message);
    return res.status(500).json({ error: "Server error while accessing/creating chat." });
  }
};

/* ── Fetch all chats for the logged-in user ─────────────────────────────────── */

/**
 * getUserChats
 * Returns all chats the authenticated user is part of,
 * with participants populated and the latest message populated.
 */
const getUserChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: { $in: [req.user._id] },
    })
      .populate("participants", "-password")
      .populate({
        path:    "latestMessage",
        populate: {
          path:   "senderId",
          select: "username email",
        },
      })
      .sort({ updatedAt: -1 });

    return res.status(200).json(chats);
  } catch (error) {
    console.error("[getUserChats] Error:", error.message);
    return res.status(500).json({ error: "Server error while fetching chats." });
  }
};

module.exports = { accessOrCreateChat, getUserChats };
