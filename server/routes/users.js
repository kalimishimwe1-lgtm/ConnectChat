import express from "express";
import pool from "../db.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/search", auth, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();

    if (!q) return res.json([]);

    const [users] = await pool.query(
      `SELECT id, name, email, is_online, last_seen
       FROM users
       WHERE id != ? AND (name LIKE ? OR email LIKE ?)
       ORDER BY name
       LIMIT 20`,
      [req.user.id, `%${q}%`, `%${q}%`]
    );

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
