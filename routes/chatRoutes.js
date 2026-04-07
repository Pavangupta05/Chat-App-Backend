/**
 * routes/chatRoutes.js
 * Chat routes — all protected by JWT middleware.
 *
 *   POST /api/chat          → create or access a one-to-one chat
 *   GET  /api/chat          → fetch all chats for the logged-in user
 *   DELETE /api/chat/:chatId → delete a chat and all its messages
 */

const express  = require("express");
const router   = express.Router();
const protect  = require("../middleware/authMiddleware");
const { accessOrCreateChat, getUserChats, deleteChat } = require("../controllers/chatController");

router.post("/",          protect, accessOrCreateChat);
router.get("/",           protect, getUserChats);
router.delete("/:chatId", protect, deleteChat);

module.exports = router;
