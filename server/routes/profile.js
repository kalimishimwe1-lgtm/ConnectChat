import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();
const uploadDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.get("/me", auth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, email, bio, profile_image, is_online, last_seen, created_at FROM users WHERE id = ?",
    [req.user.id]
  );
  res.json(rows[0]);
});

router.put("/me", auth, async (req, res) => {
  const { name, bio } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "Name is required" });

  await pool.query("UPDATE users SET name = ?, bio = ? WHERE id = ?", [
    name.trim(), bio?.trim() || null, req.user.id
  ]);

  const [rows] = await pool.query(
    "SELECT id, name, email, bio, profile_image, is_online, last_seen, created_at FROM users WHERE id = ?",
    [req.user.id]
  );
  res.json(rows[0]);
});

router.post("/me/avatar", auth, upload.single("avatar"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Please upload a JPG, PNG or WEBP image" });

  const [oldRows] = await pool.query("SELECT profile_image FROM users WHERE id = ?", [req.user.id]);
  const old = oldRows[0]?.profile_image;
  if (old) {
    const oldPath = path.join(process.cwd(), old.replace(/^\//, ""));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const imagePath = `/uploads/${req.file.filename}`;
  await pool.query("UPDATE users SET profile_image = ? WHERE id = ?", [imagePath, req.user.id]);
  res.json({ profile_image: imagePath });
});

export default router;
