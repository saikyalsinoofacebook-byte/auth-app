import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Pool } from "pg";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Register API
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    await pool.query("INSERT INTO users(email, password) VALUES($1, $2)", [
      email,
      password,
    ]);
    res.json({ message: "User registered" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login API
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (result.rows.length && result.rows[0].password === password) {
    res.json({ message: "Login success" });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

app.listen(process.env.PORT || 5000, () =>
  console.log("✅ Server running...")
);

