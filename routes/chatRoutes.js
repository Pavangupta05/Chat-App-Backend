/**
 * routes/chatRoutes.js
 * Chat routes — all protected by JWT middleware.
 *
 *   POST /api/chat   → create or access a one-to-one chat
 *   GET  /api/chat   → fetch all chats for the logged-in user
 */

const express  = require("express");
const router   = express.Router();
const protect  = require("../middleware/authMiddleware");
const { accessOrCreateChat, getUserChats } = require("../controllers/chatController");

router.post("/", protect, accessOrCreateChat);
router.get("/",  protect, getUserChats);

module.exports = router;
