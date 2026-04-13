/**
 * socket/socketHandler.js
 * Initialises Socket.io and handles all real-time events.
 *
 * Socket events handled (server → client prefix noted):
 *
 *  Client emits           Server emits back
 *  ─────────────────────  ────────────────────────────────────
 *  send_message        →  receive_message   (to target user)
 *  create_chat         →  chat_created      (to target user)
 *  delete_message      →  message_deleted   (to target user)
 *  typing_start        →  typing_update     (to target chat room)
 *  typing_stop         →  typing_update     (to target chat room)
 *  join_chat           →  (joins socket room)
 *
 * Authentication:
 *   The client passes { auth: { token } } when connecting.
 *   The middleware verifies the JWT and attaches socket.user.
 */

const jwt      = require("jsonwebtoken");
const mongoose = require("mongoose");
const User     = require("../models/User");
const Message  = require("../models/Message");
const Chat     = require("../models/Chat");

/**
 * userSocketMap — maps userId (string) → Set of socketIds.
 * Allows routing messages to ALL active tabs/devices for a user.
 * @type {Map<string, Set<string>>}
 */
const userSocketMap = new Map();

/* ── Helper: register / unregister socket entries ──────────────────────────── */

function addUserSocket(userId, socketId) {
  if (!userSocketMap.has(userId)) {
    userSocketMap.set(userId, new Set());
  }
  userSocketMap.get(userId).add(socketId);
}

function removeUserSocket(userId, socketId) {
  const sockets = userSocketMap.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) userSocketMap.delete(userId);
}

/**
 * emitToUser — sends an event to all active sockets of a given user.
 * @param {import("socket.io").Server} io
 * @param {string}                     userId
 * @param {string}                     event
 * @param {object}                     payload
 */
function emitToUser(io, userId, event, payload) {
  const sockets = userSocketMap.get(String(userId));
  if (!sockets) return;
  sockets.forEach((sid) => io.to(sid).emit(event, payload));
}

/* ── Main export ─────────────────────────────────────────────────────────────── */

/**
 * initSocket
 * @param {import("socket.io").Server} io — the Socket.io server instance
 */
function initSocket(io) {
  /* ── JWT authentication middleware ────────────────────────────────────── */
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication error: no token provided."));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.id).select("-password");

      if (!user) {
        return next(new Error("Authentication error: user not found."));
      }

      // Attach user to socket for use in event handlers
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error: invalid token."));
    }
  });

  /* ── Connection handler ───────────────────────────────────────────────── */
  io.on("connection", (socket) => {
    const userId   = socket.user._id.toString();
    const username = socket.user.username;

    console.log(`🔌 [Socket] Connected — ${username} (${userId}) @ ${socket.id}`);

    // Track socket → user mapping
    addUserSocket(userId, socket.id);

    // Broadcast online status to ALL connected sockets (presence)
    // Only broadcast on first socket connection for this user
    if (userSocketMap.get(userId)?.size === 1) {
      io.emit("user_online", { userId });
      // Update DB last seen
      User.findByIdAndUpdate(userId, { isOnline: true }).catch(() => {});
    }

    /* ── join_chat ────────────────────────────────────────────────────── */
    socket.on("join_chat", (chatId) => {
      if (chatId) {
        socket.join(String(chatId));
        console.log(`   ↳ ${username} joined room: ${chatId}`);
      }
    });

    /* ── message_delivered ────────────────────────────────────────────── */
    socket.on("message_delivered", (payload) => {
      if (!payload?.targetUserId || !payload?.messageId) return;
      emitToUser(io, String(payload.targetUserId), "message_delivered", {
        chatId:    payload.threadPeerId ?? userId,
        messageId: payload.messageId,
        status:    "delivered",
      });
    });

    /* ── message_seen ─────────────────────────────────────────────────── */
    socket.on("message_seen", (payload) => {
      if (!payload?.targetUserId || !payload?.messageId) return;
      emitToUser(io, String(payload.targetUserId), "message_seen", {
        chatId:    payload.threadPeerId ?? userId,
        messageId: payload.messageId,
        status:    "seen",
      });
    });

    /* ── send_message ─────────────────────────────────────────────────── */
    /**
     * Payload (from frontend useChatController.js):
     * {
     *   chatId, chatName, chatAccent, chatAvatar,
     *   id, text, time, type, file, fileName, mimeType,
     *   receiverId, username, forwarded
     * }
     *
     * receiverId = the peer's MongoDB _id (same as chatId for DMs)
     */
    socket.on("send_message", async (payload, callback) => {
      try {
        if (!payload?.receiverId) return;

        const receiverId = String(payload.receiverId);
        const chatId     = payload.chatId ? String(payload.chatId) : null;

        // ── Persist to MongoDB ──────────────────────────────────────────
        let dbChatId = chatId;

        // For DM chats the frontend uses the peer userId as the chatId
        // until a real Chat document exists. Look up/create the Chat doc.
        if (chatId && chatId === receiverId) {
          // chatId IS the peer userId → find or create the Chat document
          let chat = await Chat.findOne({
            $or: [
              { participants: [userId, receiverId] },
              { participants: [receiverId, userId] },
            ],
          });

          if (!chat) {
            chat = await Chat.create({ participants: [userId, receiverId] });
          }

          dbChatId = chat._id.toString();
        }

        if (dbChatId) {
          const dbMessage = await Message.create({
            senderId:  userId,
            chatId:    dbChatId,
            content:   payload.text ?? "",
            type:      payload.type ?? "text",
            fileUrl:   payload.file ?? "",
            fileName:  payload.fileName ?? "",
            mimeType:  payload.mimeType ?? "",
            forwarded: payload.forwarded ?? false,
          });

          // Keep Chat.latestMessage updated for sidebar preview
          await Chat.findByIdAndUpdate(dbChatId, { latestMessage: dbMessage._id });

          // Return the real ID to the sender via acknowledgement
          if (typeof callback === "function") {
            callback({
              status: "ok",
              id: dbMessage._id.toString(),
            });
          }
        }

        // ── Build the outgoing socket payload ───────────────────────────
        // CRITICAL FIX: The receiver's frontend identifies this chat using the SENDER'S userId!
        // If it's a one-on-one DM, flip the chatId from the receiver's ID to the sender's ID.
        const outgoingChatId = (chatId === receiverId) ? userId : chatId;

        const outgoing = {
          ...payload,
          senderUserId:  userId,
          senderSocketId: socket.id,
          chatId:        outgoingChatId,
        };

        // Deliver to the receiver (all active tabs)
        emitToUser(io, receiverId, "receive_message", outgoing);
      } catch (err) {
        console.error("[Socket] send_message error:", err.message);
      }
    });

    /* ── create_chat ──────────────────────────────────────────────────── */
    /**
     * Emitted by the frontend when the logged-in user starts a new DM.
     * Payload: { peerUserId, inviterName, accent, avatar, createdAt }
     *
     * Forwards a `chat_created` event to the target user so their sidebar
     * updates without a page refresh.
     */
    socket.on("create_chat", async (payload) => {
      try {
        if (!payload?.peerUserId) return;

        const peerUserId = String(payload.peerUserId);

        // Find or create the Chat document
        let chat = await Chat.findOne({
          $or: [
            { participants: [userId, peerUserId] },
            { participants: [peerUserId, userId] },
          ],
        });

        if (!chat) {
          chat = await Chat.create({ participants: [userId, peerUserId] });
        }

        // Notify the peer
        emitToUser(io, peerUserId, "chat_created", {
          id:        userId,        // use initiator's userId as chatId on peer side
          name:      payload.inviterName ?? username,
          accent:    payload.accent,
          avatar:    payload.avatar,
          createdAt: payload.createdAt ?? Date.now(),
        });
      } catch (err) {
        console.error("[Socket] create_chat error:", err.message);
      }
    });

    /* ── delete_message ───────────────────────────────────────────────── */
    /**
     * Payload: { chatId, messageId, receiverUserId }
     *
     * Marks the message as deleted in the DB and forwards the event to
     * the other participant so their view updates instantly.
     */
    socket.on("delete_message", async (payload) => {
      try {
        if (!payload?.messageId) return;

        // CRITICAL: Validate the messageId is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(payload.messageId)) {
          console.warn(`[Socket] Ignored delete_message with invalid ID: ${payload.messageId}`);
          return;
        }

        // Soft-delete in the database
        await Message.findByIdAndUpdate(payload.messageId, {
          deleted:  true,
          content:  "",
          fileUrl:  "",
          fileName: "",
          mimeType: "",
        });

        const receiver = String(payload.receiverUserId ?? "");
        if (receiver) {
          // Flip the chatId for the receiver if it's a DM
          const outgoingChatId = (payload.chatId === receiver) ? userId : payload.chatId;

          emitToUser(io, receiver, "message_deleted", {
            chatId:    outgoingChatId,
            messageId: payload.messageId,
          });
        }
      } catch (err) {
        console.error("[Socket] delete_message error:", err.message);
      }
    });

    /* ── typing_start ─────────────────────────────────────────────────── */
    socket.on("typing_start", (payload) => {
      if (!payload?.chatId) return;
      // relay to the peer using their userId (chatId IS the peer's userId)
      emitToUser(io, String(payload.chatId), "typing_update", {
        chatId:   userId,
        username: payload.username ?? username,
        isTyping: true,
      });
    });

    /* ── typing_stop ──────────────────────────────────────────────────── */
    socket.on("typing_stop", (payload) => {
      if (!payload?.chatId) return;
      emitToUser(io, String(payload.chatId), "typing_update", {
        chatId:   userId,
        username: payload.username ?? username,
        isTyping: false,
      });
    });

    /* ── WebRTC signalling (audio/video calls) ───────────────────────── */
    // Forward signalling events directly to the target peer's sockets

    socket.on("call_user", async (payload) => {
      let targetUserId = String(payload?.receiverUserId ?? "");

      // If target hasn't connected sockets, could it be a misaligned dbChatId from old cache?
      if (!userSocketMap.has(targetUserId)) {
        try {
          const chatFallback = await Chat.findById(targetUserId);
          if (chatFallback && chatFallback.participants) {
            const truePeer = chatFallback.participants.find((p) => String(p) !== userId);
            if (truePeer) {
              targetUserId = String(truePeer);
            }
          }
        } catch (e) {
          // ignore invalid ObjectIds
        }
      }

      // If the peer is genuinely offline or unroutable, immediately fail the call
      if (!userSocketMap.has(targetUserId)) {
        return io.to(socket.id).emit("end_call", { 
          chatId: payload.chatId,
          reason: "User is offline or unavailable" 
        });
      }

      // Flip the chatId so the recipient maps the call strictly to the caller
      const outgoingChatId = (payload.chatId === String(payload.receiverUserId) || payload.chatId === targetUserId) 
        ? userId 
        : payload.chatId;

      emitToUser(io, targetUserId, "incoming_call", {
        ...payload, 
        callerSocketId: socket.id,
        chatId: outgoingChatId,
        receiverUserId: targetUserId // <--- FIX: Ensure frontend bypasses ID filter
      });
    });

    socket.on("call_accepted", (payload) => {
      if (payload?.targetSocketId) {
        io.to(payload.targetSocketId).emit("call_accepted", {
          ...payload, responderSocketId: socket.id,
        });
      }
    });

    socket.on("end_call", (payload) => {
      // Broadcast end_call to the peer so they hang up
      const targetUserId = String(payload?.receiverUserId ?? "");
      if (targetUserId) {
        emitToUser(io, targetUserId, "end_call", {
          ...payload,
          receiverUserId: targetUserId,
        });
      }
    });

    socket.on("callEnded", (payload) => {
      // Dedicated callEnded event — forward to target without cross-emitting end_call
      const targetUserId = String(payload?.to ?? "");
      if (targetUserId) {
        emitToUser(io, targetUserId, "callEnded", { from: userId });
      }
    });

    /* ── profile_updated ──────────────────────────────────────────────── */
    /**
     * Payload: { userId, username, profilePic }
     * 
     * Broadcasts profile changes to ALL connected clients so their 
     * sidebars/chats update in real-time.
     */
    socket.on("profile_updated", (payload) => {
      if (!payload?.userId) return;
      console.log(`👤 [Socket] Profile updated — ${payload.username} (${payload.userId})`);
      // Broadcast to all OTHER connected clients (not back to the sender)
      socket.broadcast.emit("user_updated", payload);
      socket.broadcast.emit("profileUpdated", payload);
    });

    socket.on("profileUpdated", (payload) => {
      if (!payload?.userId) return;
      socket.broadcast.emit("profileUpdated", payload);
      socket.broadcast.emit("user_updated", payload);
    });

    /* ── Disconnect ───────────────────────────────────────────────────── */
    socket.on("disconnect", (reason) => {
      console.log(`🔌 [Socket] Disconnected — ${username} (${userId}) reason: ${reason}`);
      removeUserSocket(userId, socket.id);

      // Broadcast offline + update lastSeen when ALL sockets for user are gone
      if (!userSocketMap.has(userId)) {
        const lastSeen = new Date();
        io.emit("user_offline", { userId, lastSeen });
        User.findByIdAndUpdate(userId, { isOnline: false, lastSeen }).catch(() => {});
      }
    });
  });
}

module.exports = { initSocket, emitToUser, userSocketMap };
