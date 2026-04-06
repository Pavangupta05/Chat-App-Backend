/**
 * routes/messageRoutes.js
 * Message routes — all protected by JWT middleware.
 *
 *   POST /api/messages           → send a message to a chat
 *   GET  /api/messages           → get messages between logged-in user and ?withUserId=
 *   GET  /api/messages/:chatId   → get all messages for a given chatId
 */

const express  = require("express");
const router   = express.Router();
const protect  = require("../middleware/authMiddleware");
const {
  sendMessage,
  getMessagesBetweenUsers,
  getMessagesForChat,
} = require("../controllers/messageController");

router.post("/",        protect, sendMessage);
router.get("/",         protect, getMessagesBetweenUsers);
router.get("/:chatId",  protect, getMessagesForChat);

module.exports = router;
