import express from "express";
import pool from "../db.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id,
              u.id AS other_id,
              u.name AS other_name,
              u.email AS other_email,
              u.is_online,
              u.last_seen,
              (SELECT message FROM messages
               WHERE conversation_id = c.id
               ORDER BY id DESC LIMIT 1) AS last_message,
              (SELECT created_at FROM messages
               WHERE conversation_id = c.id
               ORDER BY id DESC LIMIT 1) AS last_message_time
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       JOIN users u ON u.id = cm.user_id
       WHERE c.id IN (
         SELECT conversation_id
         FROM conversation_members
         WHERE user_id = ?
       )
       AND u.id != ?
       ORDER BY last_message_time DESC, c.id DESC`,
      [req.user.id, req.user.id]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/private", auth, async (req, res) => {
  try {
    const otherUserId = Number(req.body.userId);

    if (!otherUserId || otherUserId === req.user.id) {
      return res.status(400).json({ message: "Invalid user" });
    }

    const [existing] = await pool.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_members cm1 ON cm1.conversation_id = c.id
       JOIN conversation_members cm2 ON cm2.conversation_id = c.id
       WHERE cm1.user_id = ? AND cm2.user_id = ?
       GROUP BY c.id
       HAVING COUNT(DISTINCT cm1.user_id) = 1`,
      [req.user.id, otherUserId]
    );

    if (existing.length) {
      return res.json({ conversationId: existing[0].id });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [conversation] = await connection.query(
        "INSERT INTO conversations () VALUES ()"
      );

      await connection.query(
        "INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)",
        [conversation.insertId, req.user.id, conversation.insertId, otherUserId]
      );

      await connection.commit();

      res.status(201).json({ conversationId: conversation.insertId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/messages", auth, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);

    const [member] = await pool.query(
      "SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
      [conversationId, req.user.id]
    );

    if (!member.length) {
      return res.status(403).json({ message: "Access denied" });
    }

    const [messages] = await pool.query(
      `SELECT m.id, m.message, m.sender_id, m.is_read, m.created_at,
              u.name AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.id ASC`,
      [conversationId]
    );

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
