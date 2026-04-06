/**
 * controllers/messageController.js
 * Handles sending and fetching messages.
 *
 * Routes consumed:
 *   POST /api/messages          → sendMessage
 *   GET  /api/messages          → getMessagesBetweenUsers  (?withUserId=<id>)
 *   GET  /api/messages/:chatId  → getMessagesForChat
 */

const Chat    = require("../models/Chat");
const Message = require("../models/Message");
const mongoose = require("mongoose");

/* ── Helpers ────────────────────────────────────────────────────────────────── */

/**
 * formatMessage — converts a raw Mongoose Message document into the
 * frontend-compatible shape expected by the React app.
 *
 * The frontend stores messages with:
 *   { id, sender ("me"|"other"), senderUserId, text, time, type,
 *     file, fileName, mimeType, forwarded, deleted, username, chatId }
 */
function formatMessage(msg, requestingUserId) {
  const isMe = msg.senderId?._id
    ? msg.senderId._id.toString() === requestingUserId
    : msg.senderId?.toString() === requestingUserId;

  const time = new Date(msg.createdAt).toLocaleTimeString("en-US", {
    hour:   "2-digit",
    minute: "2-digit",
  });

  return {
    id:          msg._id.toString(),
    sender:      isMe ? "me" : "other",
    senderUserId: (msg.senderId?._id ?? msg.senderId)?.toString() ?? "",
    username:    msg.senderId?.username ?? "Unknown",
    text:        msg.content ?? "",
    time,
    type:        msg.type ?? "text",
    file:        msg.fileUrl ?? "",
    fileName:    msg.fileName ?? "",
    mimeType:    msg.mimeType ?? "",
    forwarded:   msg.forwarded ?? false,
    deleted:     msg.deleted ?? false,
    chatId:      msg.chatId?.toString() ?? "",
  };
}

/* ── Send a message ─────────────────────────────────────────────────────────── */

/**
 * sendMessage
 * Body: { chatId, content, type?, fileUrl?, fileName?, mimeType?, forwarded? }
 *
 * • Validates the chat exists and the sender is a participant.
 * • Creates the message and updates Chat.latestMessage.
 */
const sendMessage = async (req, res) => {
  try {
    const {
      chatId,
      content  = "",
      type     = "text",
      fileUrl  = "",
      fileName = "",
      mimeType = "",
      forwarded = false,
    } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required." });
    }

    // Validate the chat and membership
    const chat = await Chat.findOne({
      _id:          chatId,
      participants: { $in: [req.user._id] },
    });

    if (!chat) {
      return res
        .status(404)
        .json({ error: "Chat not found or you are not a participant." });
    }

    // Create the message
    const message = await Message.create({
      senderId:  req.user._id,
      chatId:    chat._id,
      content,
      type,
      fileUrl,
      fileName,
      mimeType,
      forwarded,
    });

    // Update Chat.latestMessage for sidebar preview
    await Chat.findByIdAndUpdate(chat._id, { latestMessage: message._id });

    // Populate sender info before returning
    const populated = await message.populate("senderId", "username email");

    return res.status(201).json(formatMessage(populated, req.user._id.toString()));
  } catch (error) {
    console.error("[sendMessage] Error:", error.message);
    return res.status(500).json({ error: "Server error while sending message." });
  }
};

/* ── Fetch messages between two users ───────────────────────────────────────── */

/**
 * getMessagesBetweenUsers
 * Query: ?withUserId=<mongoId>
 *
 * The frontend (messageService.js → fetchMessagesBetween) calls this endpoint
 * with the peer's _id to load message history for a DM.
 *
 * Flow:
 *   1. Find the Chat document for this pair.
 *   2. Return all messages for that chat in ascending order.
 */
const getMessagesBetweenUsers = async (req, res) => {
  try {
    const { withUserId } = req.query;

    if (!withUserId) {
      return res.status(400).json({ error: "withUserId query parameter is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(withUserId)) {
      return res.status(400).json({ error: "withUserId must be a valid MongoDB ObjectId." });
    }

    // Find the exact chat between the two users
    const chat = await Chat.findOne({
      $or: [
        { participants: [req.user._id, withUserId] },
        { participants: [withUserId, req.user._id] },
      ],
    });

    if (!chat) {
      // No chat exists yet — return empty array (frontend handles this gracefully)
      return res.status(200).json([]);
    }

    // Fetch messages, oldest first
    const messages = await Message.find({ chatId: chat._id })
      .populate("senderId", "username email")
      .sort({ createdAt: 1 });

    const formatted = messages.map((m) =>
      formatMessage(m, req.user._id.toString())
    );

    return res.status(200).json(formatted);
  } catch (error) {
    console.error("[getMessagesBetweenUsers] Error:", error.message);
    return res.status(500).json({ error: "Server error while fetching messages." });
  }
};

/* ── Fetch messages by chatId ───────────────────────────────────────────────── */

/**
 * getMessagesForChat
 * Params: :chatId
 *
 * Returns all messages for the given chat (user must be a participant).
 */
const getMessagesForChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: "Invalid chatId." });
    }

    // Verify the user is a participant
    const chat = await Chat.findOne({
      _id:          chatId,
      participants: { $in: [req.user._id] },
    });

    if (!chat) {
      return res
        .status(404)
        .json({ error: "Chat not found or you are not a participant." });
    }

    const messages = await Message.find({ chatId: chat._id })
      .populate("senderId", "username email")
      .sort({ createdAt: 1 });

    const formatted = messages.map((m) =>
      formatMessage(m, req.user._id.toString())
    );

    return res.status(200).json(formatted);
  } catch (error) {
    console.error("[getMessagesForChat] Error:", error.message);
    return res.status(500).json({ error: "Server error while fetching chat messages." });
  }
};

module.exports = { sendMessage, getMessagesBetweenUsers, getMessagesForChat };
