/**
 * models/Chat.js
 * Represents a one-to-one (or group) conversation between users.
 *
 * Fields:
 *   participants — array of User _id references (exactly 2 for DMs)
 *   latestMessage — reference to the most recent Message document
 *   timestamps   — createdAt / updatedAt added automatically
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
