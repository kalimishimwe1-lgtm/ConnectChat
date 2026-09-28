import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    if (name.length < 2) {
      return res.status(400).json({ message: "Name must contain at least 2 characters." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from server/.env");
      return res.status(500).json({ message: "Server configuration error: JWT_SECRET is missing." });
    }

    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing.length) {
      return res.status(409).json({ message: "This email is already registered. Please login." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );

    const user = { id: result.insertId, name, email };
    const token = makeToken(user);

    return res.status(201).json({
      message: "Registration successful",
      user,
      token
    });
  } catch (error) {
    console.error("REGISTRATION ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "This email is already registered. Please login." });
    }

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "Database table 'users' was not found. Import database/schema.sql into MySQL first."
      });
    }

    if (error.code === "ECONNREFUSED") {
      return res.status(500).json({
        message: "Cannot connect to MySQL. Make sure MySQL is running and your .env settings are correct."
      });
    }

    return res.status(500).json({
      message: "Registration failed. Check the server terminal for the exact error."
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    await pool.query("UPDATE users SET is_online = TRUE WHERE id = ?", [user.id]);

    const safeUser = { id: user.id, name: user.name, email: user.email };
    res.json({ user: safeUser, token: makeToken(safeUser) });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Login failed. Check the server terminal." });
  }
});

export default router;
