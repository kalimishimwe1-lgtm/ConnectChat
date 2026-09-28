import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import pool from "./db.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import conversationRoutes from "./routes/conversations.js";
import profileRoutes from "./routes/profile.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.json({ message: "ChatConnect API is running" });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, message: "MySQL connection is working" });
  } catch (error) {
    console.error("DATABASE HEALTH ERROR:", error);
    res.status(500).json({ ok: false, message: "MySQL connection failed", error: error.code || error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/profile", profileRoutes);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) return next(new Error("Authentication required"));

    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.user.id;

  await pool.query(
    "UPDATE users SET is_online = TRUE WHERE id = ?",
    [userId]
  );

  socket.join(`user:${userId}`);

  socket.on("join_conversation", (conversationId) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on("send_message", async ({ conversationId, message }) => {
    try {
      if (!message?.trim()) return;

      const [member] = await pool.query(
        `SELECT id FROM conversation_members
         WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, userId]
      );

      if (!member.length) return;

      const [result] = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, message)
         VALUES (?, ?, ?)`,
        [conversationId, userId, message.trim()]
      );

      const [rows] = await pool.query(
        `SELECT m.id, m.message, m.sender_id, m.created_at,
                u.name AS sender_name
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.id = ?`,
        [result.insertId]
      );

      io.to(`conversation:${conversationId}`).emit(
        "new_message",
        rows[0]
      );
    } catch (error) {
      console.error("Socket message error:", error);
    }
  });

  socket.on("typing", ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit("user_typing", {
      userId,
      name: socket.user.name
    });
  });

  socket.on("disconnect", async () => {
    await pool.query(
      "UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?",
      [userId]
    );
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`ChatConnect server running on http://localhost:${PORT}`);
  try {
    await pool.query("SELECT 1");
    console.log("MySQL connection: OK");
  } catch (error) {
    console.error("MySQL connection: FAILED");
    console.error(error.message);
  }
});
