/**
 * models/Chat.js
 * Represents a one-to-one (or group) conversation between users.
 *
 * Fields:
 *   participants  — array of User _id references (exactly 2 for DMs, 2+ for groups)
 *   latestMessage — reference to the most recent Message document
 *   isGroupChat   — true for group chats, false for DMs
 *   chatName      — display name for group chats
 *   groupAdmin    — User _id of the group creator/admin
 *   anyoneCanAdd  — whether any member can add new participants
 *   groupAccent   — accent color for group avatar
 *   groupAvatar   — avatar URL/emoji for group
 *   timestamps    — createdAt / updatedAt added automatically
 */

const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    /** The users participating in this conversation */
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  "User",
      },
    ],

    /** Populated lazily — points to the last message sent in this chat */
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Message",
    },

    /** True for group chats, false (default) for direct messages */
    isGroupChat: {
      type:    Boolean,
      default: false,
    },

    /** Display name for group chats */
    chatName: {
      type:    String,
      default: "",
      trim:    true,
    },

    /** User ID of the group creator / admin */
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
    },

    /** Controls whether any member can invite new participants */
    anyoneCanAdd: {
      type:    Boolean,
      default: true,
    },

    /** Accent colour for the group avatar (CSS color string) */
    groupAccent: {
      type:    String,
      default: "",
    },

    /** Avatar URL or emoji for the group */
    groupAvatar: {
      type:    String,
      default: "",
    },
  },
  { timestamps: true }
);

/* ── Performance indexes ─────────────────────────────────────────────────── */
chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("Chat", chatSchema);
