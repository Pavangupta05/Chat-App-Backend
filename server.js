/**
 * server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Entry point for the Chat App backend.
 *
 * Responsibilities:
 *   • Load environment variables from .env
 *   • Connect to MongoDB Atlas
 *   • Configure Express (CORS, JSON parsing, routes)
 *   • Attach Socket.io to the HTTP server
 *   • Start listening on PORT (default 5000)
 *
 * Run with:
 *   npm run dev   (nodemon — auto-restart on changes)
 *   npm start     (plain node — production)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── 1. Environment variables ──────────────────────────────────────────────────
require("dotenv").config();

// ── 2. Core imports ───────────────────────────────────────────────────────────
const http    = require("http");
const express = require("express");
const cors    = require("cors");
const { Server } = require("socket.io");
const multer  = require("multer");
const fs      = require("fs");
const path    = require("path");

// ── 3. Internal imports ───────────────────────────────────────────────────────
const connectDB       = require("./config/db");
const authRoutes      = require("./routes/authRoutes");
const userRoutes      = require("./routes/userRoutes");
const chatRoutes      = require("./routes/chatRoutes");
const messageRoutes   = require("./routes/messageRoutes");
const { initSocket }  = require("./socket/socketHandler");

// ── 4. Connect to MongoDB ─────────────────────────────────────────────────────
connectDB();

// ── 5. Express app ────────────────────────────────────────────────────────────
const app = express();

/**
 * CORS — allow requests from the React frontend.
 * The frontend runs on localhost:3000 (CRA default) or localhost:5173 (Vite).
 * Both origins are whitelisted here for development convenience.
 *
 * In production, replace with your actual frontend URL.
 */
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. Postman, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} is not allowed.`));
      }
    },
    methods:     ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Parse incoming JSON bodies
app.use(express.json({ limit: "10mb" }));
// Parse URL-encoded bodies (form submissions)
app.use(express.urlencoded({ extended: true }));

// ── 6. API Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);      // POST /api/auth/register | /api/auth/login
app.use("/api/users",    userRoutes);      // GET  /api/users
app.use("/api/chat",     chatRoutes);      // POST /api/chat | GET /api/chat
app.use("/api/messages", messageRoutes);   // POST /api/messages | GET /api/messages | GET /api/messages/:chatId

// ── 6.5 File Uploads ──────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Please select a file first." });
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.status(200).json({
    fileUrl,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

app.use("/uploads", express.static(uploadDir));

// ── 7. Health-check endpoint ──────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    status:    "ok",
    timestamp: new Date().toISOString(),
    uptime:    `${Math.floor(process.uptime())}s`,
  });
});

// ── 8. 404 fallback ───
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// ── 9. Global error handler ───
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[Express] Unhandled error:", err.message);
  res.status(500).json({ error: err.message || "Internal server error." });
});

// ── 10. HTTP + Socket.io server ───
const httpServer = http.createServer(app);

/**
 * Socket.io server — mirrors the CORS config above.
 * The frontend connects with:
 *   io(SOCKET_URL, { auth: { token } })
 */
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods:     ["GET", "POST"],
    credentials: true,
  },
  // Use websocket first, fallback to polling
  transports: ["websocket", "polling"],
});

// Attach all socket event listeners
initSocket(io);

// ── 11. Start listening ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log(`║  🚀  Server running on port ${PORT}          ║`);
  console.log(`║  📡  Socket.io ready                     ║`);
  console.log(`║  🌐  http://localhost:${PORT}               ║`);
  console.log("╚══════════════════════════════════════════╝\n");
});
