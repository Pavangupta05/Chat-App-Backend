/**
 * models/Message.js
 * A single message inside a chat conversation.
 *
 * Fields:
 *   senderId  — reference to the User who sent the message
 *   chatId    — reference to the Chat this message belongs to
 *   content   — plain text body of the message
 *   type      — "text" | "file" (extended for file uploads)
 *   fileUrl   — URL of the uploaded file (type === "file")
 *   fileName  — original file name
 *   mimeType  — MIME type for rendering purposes
 *   forwarded — whether this is a forwarded message
 *   timestamps — createdAt / updatedAt added automatically
 */

const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    chatId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Chat",
      required: true,
    },

    content: {
      type:    String,
      default: "",
    },

    type: {
      type:    String,
      enum:    ["text", "file"],
      default: "text",
    },

    fileUrl: {
      type:    String,
      default: "",
    },

    fileName: {
      type:    String,
      default: "",
    },

    mimeType: {
      type:    String,
      default: "",
    },

    forwarded: {
      type:    Boolean,
      default: false,
    },

    deleted: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
