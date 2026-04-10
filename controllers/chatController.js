/**
 * controllers/chatController.js
 * Manages one-to-one chat creation, retrieval, and deletion.
 *
 * Routes consumed:
 *   POST /api/chat       → accessOrCreateChat (create or fetch a DM)
 *   GET  /api/chat       → getUserChats       (all chats for the current user)
 *   DELETE /api/chat/:chatId → deleteChat   (delete a chat and its messages)
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

/* ── Delete a chat ──────────────────────────────────────────────────────────── */

/**
 * deleteChat
 * Params: :chatId
 *
 * • Verifies the user is a participant in the chat
 * • Deletes all messages associated with the chat
 * • Deletes the chat itself
 * • Returns success message
 */
const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required." });
    }

    // 1. First, try to find the chat by its primary ID
    let chat = await Chat.findById(chatId);

    // 2. SMART RESOLUTION: If not found by ID, check if it's a Peer User ID
    if (!chat) {
      console.log(`[SmartResolution] Delete requested for ${chatId} (Chat ID not found). Checking if it's a User ID...`);
      chat = await Chat.findOne({
        participants: { $all: [req.user._id, chatId] }
      });
    }

    if (!chat) {
      return res.status(404).json({ error: "Chat not found or you are not a participant." });
    }

    // 3. Extra safety: Verify the user is actually a participant
    const isParticipant = chat.participants.some(p => String(p) === String(req.user._id));
    if (!isParticipant) {
      return res.status(403).json({ error: "Access denied. You are not a participant in this chat." });
    }

    // Delete all messages in this chat
    await Message.deleteMany({ chatId: chat._id });

    // Delete the chat
    await Chat.findByIdAndDelete(chat._id);

    console.log("[deleteChat] Chat deleted successfully:", chatId);
    return res.status(200).json({ message: "Chat deleted successfully." });
  } catch (error) {
    console.error("[deleteChat] Error:", error.message);
    return res.status(500).json({ error: "Server error while deleting chat." });
  }
};

module.exports = { accessOrCreateChat, getUserChats, deleteChat };
