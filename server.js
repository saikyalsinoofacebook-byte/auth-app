// server.js (FULL REWRITE — NO onhold usage)
// Requires Node >=14 with "type":"module" in package.json (or convert imports to require)
import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// uploads folder
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(process.cwd(), "public")));

// multer for screenshots
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ext);
  },
});
const upload = multer({ storage });

// helper: transactional client
async function withClient(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await fn(client);
    await client.query("COMMIT");
    return r;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* ----------------- ROUTES ----------------- */

app.get("/", (req, res) => res.send("API running"));

// Register
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (exists.rows.length) return res.status(400).json({ error: "Email already registered" });

    const userRes = await pool.query(
      "INSERT INTO users (name,email,password) VALUES($1,$2,$3) RETURNING id,name,email",
      [name, email, password]
    );
    const user = userRes.rows[0];

    // create wallet if not exists
    await pool.query(
      "INSERT INTO wallets (user_id,user_name,user_email,balance,created_at) VALUES($1,$2,$3,0,NOW())",
      [user.id, user.name, user.email]
    );

    res.status(201).json({ message: "Registered", user });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Register failed" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const r = await pool.query("SELECT id,name,email,password FROM users WHERE email=$1", [email]);
    if (!r.rows.length) return res.status(400).json({ error: "Invalid credentials" });

    const user = r.rows[0];
    if (user.password !== password) return res.status(400).json({ error: "Invalid credentials" });

    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Fetch wallet by user ID
app.get("/api/wallet/:userId", async (req, res) => {
  console.log("=== WALLET REQUEST ===");
  console.log("User ID:", req.params.userId);

  try {
    let result = await pool.query(
      "SELECT balance, tokens FROM wallets WHERE user_id = $1",
      [req.params.userId]
    );

    if (result.rows.length === 0) {
      console.log("❌ Wallet not found for user:", req.params.userId);
      console.log("🔧 Creating new wallet for user:", req.params.userId);
      
      // Create wallet for user
      await pool.query(
        "INSERT INTO wallets(user_id, balance, tokens) VALUES($1, 0, 0)",
        [req.params.userId]
      );
      console.log("✅ Wallet created for user:", req.params.userId);
      
      // Fetch the newly created wallet
      result = await pool.query(
        "SELECT balance, tokens FROM wallets WHERE user_id = $1",
        [req.params.userId]
      );
    }

    const wallet = result.rows[0];
    console.log("✅ Wallet found:", wallet);

    res.json({
      balance: parseFloat(wallet.balance) || 0,
      available_balance: parseFloat(wallet.balance) || 0,
      on_hold_balance: parseFloat(wallet.tokens) || 0,
    });
  } catch (err) {
    console.error("Wallet error:", err);
    if (err.code === '28P01') {
      res.status(500).json({ error: "Database authentication failed. Please check database credentials." });
    } else if (err.code === 'ECONNREFUSED') {
      res.status(500).json({ error: "Cannot connect to database. Please check if PostgreSQL is running." });
    } else {
      res.status(500).json({ error: "Server error: " + err.message });
    }
  }
});

// Transactions (user)
app.get("/api/transactions/:userId", async (req, res) => {
  console.log("=== TRANSACTIONS REQUEST ===");
  console.log("User ID:", req.params.userId);
  
  try {
    const result = await pool.query(
      "SELECT id,user_id,user_email,amount,type,status,method,phone,recipient,remark,screenshot,created_at FROM transactions WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50",
      [req.params.userId]
    );
    console.log("✅ Transactions found:", result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error("Transactions fetch error:", err);
    if (err.code === '28P01') {
      res.status(500).json({ error: "Database authentication failed. Please check database credentials." });
    } else if (err.code === 'ECONNREFUSED') {
      res.status(500).json({ error: "Cannot connect to database. Please check if PostgreSQL is running." });
    } else {
      res.status(500).json({ error: "Failed to fetch transactions: " + err.message });
    }
  }
});

// Admin transactions
app.get("/api/admin/transactions", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM transactions ORDER BY created_at DESC");
    res.json(r.rows);
  } catch (err) {
    console.error("Admin transactions error:", err);
    res.status(500).json({ error: "Failed to fetch admin transactions" });
  }
});

// Deposit (user uploads proof) - keeps Pending until admin approves
app.post("/api/deposit", upload.single("screenshot"), async (req, res) => {
  console.log("=== DEPOSIT REQUEST ===");
  console.log("Body:", req.body);
  console.log("File:", req.file);
  console.log("Content-Type:", req.headers['content-type']);

  const { user_id, amount, method, remark } = req.body;
  const screenshot = req.file ? `/uploads/${req.file.filename}` : null;
  
  console.log("Parsed values:", { user_id, amount, method, remark });
  console.log("user_id type:", typeof user_id);
  console.log("amount type:", typeof amount);

  if (!user_id || !amount || !method) {
    console.log("❌ Validation failed: Missing required fields");
    return res.status(400).json({ error: "Missing fields: user_id, amount, and method are required" });
  }

  try {
    // Get user email from user_id
    const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [user_id]);
    if (userResult.rows.length === 0) {
      console.log("❌ User not found for ID:", user_id);
      return res.status(404).json({ error: "User not found" });
    }
    const user_email = userResult.rows[0].email;
    console.log("✅ User email found:", user_email);

    // Create transaction
    const tx = await pool.query(
      `INSERT INTO transactions (user_id,user_email,amount,type,status,method,remark,screenshot,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
      [user_id, user_email, Number(amount), "deposit", "Pending", method, remark || null, screenshot]
    );

    console.log("✅ Transaction created:", tx.rows[0]);
    res.json({ message: "Deposit submitted (Pending)", transaction: tx.rows[0] });
  } catch (err) {
    console.error("Deposit error:", err);
    res.status(500).json({ error: "Deposit failed: " + err.message });
  }
});

// Withdraw request (user) - creates Pending transaction; balance is checked but not deducted here
app.post("/api/withdraw", async (req, res) => {
  const { email, amount, method, phone, recipient } = req.body;
  if (!email || !amount || !method || !phone || !recipient) return res.status(400).json({ error: "Missing fields" });

  try {
    const w = await pool.query("SELECT * FROM wallets WHERE user_email=$1", [email]);
    if (!w.rows.length) return res.status(404).json({ error: "Wallet not found" });
    const wallet = w.rows[0];

    if (parseFloat(wallet.balance) < Number(amount)) return res.status(400).json({ error: "Insufficient balance" });

    // create pending withdraw transaction (no balance change yet)
    const tx = await pool.query(
      `INSERT INTO transactions (user_id,user_email,amount,type,status,method,phone,recipient,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
      [wallet.user_id, email, -Number(amount), "withdraw", "Pending", method, phone, recipient]
    );

    res.json({ message: "Withdraw requested (Pending)", transaction: tx.rows[0] });
  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ error: "Withdraw failed" });
  }
});

// Admin approves withdraw (deducts balance and marks transaction Completed)
app.post("/api/withdraw/approve/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await withClient(async (client) => {
      const txr = await client.query("SELECT * FROM transactions WHERE id=$1 FOR UPDATE", [id]);
      if (!txr.rows.length) throw { status: 404, message: "Transaction not found" };
      const tx = txr.rows[0];
      if (tx.type !== "withdraw") throw { status: 400, message: "Not a withdraw transaction" };
      if (tx.status !== "Pending") throw { status: 400, message: "Only Pending withdraw can be approved" };

      const wr = await client.query("SELECT * FROM wallets WHERE user_email=$1 FOR UPDATE", [tx.user_email]);
      if (!wr.rows.length) throw { status: 404, message: "Wallet not found" };
      const wallet = wr.rows[0];

      const amount = Math.abs(Number(tx.amount));
      if (parseFloat(wallet.balance) < amount) throw { status: 400, message: "Insufficient balance" };

      // Update transaction status to Completed
      // This will trigger the database trigger that handles balance updates
      await client.query("UPDATE transactions SET status='Completed' WHERE id=$1", [id]);
      console.log("✅ Transaction marked as Completed");
      
      // The database trigger will handle balance updates automatically
      // For deposits: balance = balance + amount (positive amount)
      // For withdrawals: balance = balance + amount (negative amount, so it subtracts)
      console.log("✅ Balance updated by database trigger");
      console.log("✅ Withdrawal amount (negative):", tx.amount);
    });

    res.json({ message: "Withdraw approved" });
  } catch (err) {
    console.error("Withdraw approve error:", err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Approve failed" });
  }
});

/* ---------------- Orders (NO onhold) ---------------- */

// Create Order (supports optional screenshot)
app.post("/api/orders", upload.single("screenshot"), async (req, res) => {
  const body = req.body || {};
  const email = body.email;
  const item = body.item;
  const price = Number(body.price);
  const method = body.method;
  const gameId = body.gameId || null;
  const gameName = body.gameName || "MLBB";
  
  // Set default serverId based on game type
  let serverId = body.serverId;
  if (!serverId || serverId === "N/A" || serverId === "") {
    if (gameName === "HOK" || gameName === "UC") {
      serverId = "Default"; // Default server for HOK and UC shops
    } else {
      serverId = "N/A"; // For other games like Telegram
    }
  }
  
  const payerName = body.payerName || null;
  const payerPhone = body.payerPhone || null;
  const screenshot = req.file ? `/uploads/${req.file.filename}` : body.screenshot || null;

  if (!email || !item || !price || !method) return res.status(400).json({ error: "Missing required fields" });

  try {
    // check user exists
    const userRes = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!userRes.rows.length) return res.status(404).json({ error: "User not found" });
    const user = userRes.rows[0];

    // check wallet balance if method wallet (do not deduct)
    if (method === "wallet") {
      const w = await pool.query("SELECT balance FROM wallets WHERE user_email=$1", [email]);
      if (!w.rows.length) return res.status(404).json({ error: "Wallet not found" });
      const balance = parseFloat(w.rows[0].balance);
      if (balance < price) return res.status(400).json({ error: "ဒီနေရာမှာငွေအလုံအလောက် သင့် wallet တွင်မရှိပါ" });
    }

    // create order + pending transaction (no balance changes)
    const created = await withClient(async (client) => {
      const orderId = Math.random().toString(36).substring(2, 9).toUpperCase();

      const or = await client.query(
        `INSERT INTO orders (order_id,user_email,item,game_id,server_id,game_name,price,method,phone,recipient,screenshot,status,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Pending',NOW()) RETURNING *`,
        [orderId, email, item, gameId, serverId, gameName, price, method, payerPhone || null, payerName || null, screenshot]
      );

      const tx = await client.query(
        `INSERT INTO transactions (user_id,user_email,amount,type,status,method,phone,recipient,screenshot,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING *`,
        [user.id, email, -Number(price), "order", "Pending", method, payerPhone || null, payerName || null, screenshot]
      );

      return { order: or.rows[0], transaction: tx.rows[0] };
    });

    res.json({ message: "Order created (Pending)", order: created.order, transaction: created.transaction });
  } catch (err) {
    console.error("Order create error:", err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Order create failed" });
  }
});

// Fetch orders (user) — supports query ?email= or path param
app.get("/api/orders", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "email query required, or use /api/orders/:email" });
  try {
    const r = await pool.query("SELECT * FROM orders WHERE user_email=$1 ORDER BY created_at DESC", [email]);
    res.json(r.rows);
  } catch (err) {
    console.error("Orders fetch error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});
app.get("/api/orders/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const r = await pool.query("SELECT * FROM orders WHERE user_email=$1 ORDER BY created_at DESC", [email]);
    res.json(r.rows);
  } catch (err) {
    console.error("Orders fetch (param) error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Admin fetch all orders / by email
app.get("/api/admin/orders", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
    res.json(r.rows);
  } catch (err) {
    console.error("Admin orders fetch error:", err);
    res.status(500).json({ error: "Failed to fetch admin orders" });
  }
});
app.get("/api/admin/orders/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const r = await pool.query("SELECT * FROM orders WHERE user_email=$1 ORDER BY created_at DESC", [email]);
    res.json(r.rows);
  } catch (err) {
    console.error("Admin orders by email error:", err);
    res.status(500).json({ error: "Failed to fetch admin orders" });
  }
});

// Update order status (admin) — Completed or Cancelled
// body: { status: "Completed" | "Cancelled" | "Pending" }
app.put("/api/orders/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "status required" });

  try {
    await withClient(async (client) => {
      const or = await client.query("SELECT * FROM orders WHERE order_id=$1 FOR UPDATE", [orderId]);
      if (!or.rows.length) throw { status: 404, message: "Order not found" };
      const order = or.rows[0];

      if (order.status === status) {
        // nothing to do
        return;
      }

      // When completing: deduct user's wallet balance (only now)
      if (status.toLowerCase() === "completed") {
        if (order.method === "wallet") {
          const wr = await client.query("SELECT * FROM wallets WHERE user_email=$1 FOR UPDATE", [order.user_email]);
          if (!wr.rows.length) throw { status: 404, message: "Wallet not found" };
          const wallet = wr.rows[0];
          const price = Number(order.price || 0);

          if (parseFloat(wallet.balance) < price) {
            throw { status: 400, message: "Insufficient funds to complete order" };
          }

          // deduct balance now
          await client.query("UPDATE wallets SET balance = balance - $1 WHERE user_email = $2", [price, order.user_email]);
        }

        // mark transactions related to this order as Completed
        await client.query(
          "UPDATE transactions SET status='Completed' WHERE user_email=$1 AND type='order' AND amount = $2 AND status='Pending'",
          [order.user_email, -Number(order.price)]
        );
      }

      // When cancelling: do NOT touch balance (we never reserved). Just mark pending tx cancelled.
      if (status.toLowerCase() === "cancelled") {
        await client.query(
          "UPDATE transactions SET status='Cancelled' WHERE user_email=$1 AND type='order' AND amount = $2 AND status='Pending'",
          [order.user_email, -Number(order.price)]
        );
      }

      // update order status
      await client.query("UPDATE orders SET status=$1 WHERE order_id=$2", [status, orderId]);
    });

    res.json({ message: "Order status updated" });
  } catch (err) {
    console.error("Update order status error:", err);
    const st = err.status || 500;
    res.status(st).json({ error: err.message || "Failed to update order status" });
  }
});

// Confirm an order: mark Completed and deduct balance
app.post('/api/orders/confirm/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await withClient(async (client) => {
      // Order ကို lock လုပ်ပြီး select
      const txRes = await client.query(
        "SELECT * FROM transactions WHERE id=$1 FOR UPDATE",
        [id]
      );

      if (!txRes.rows.length) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const tx = txRes.rows[0];
      if (tx.type !== "order") {
        return res.status(400).json({ error: "Not an order transaction" });
      }
      if (tx.status !== "Pending") {
        return res.status(400).json({ error: "Only Pending order can be confirmed" });
      }

      // Wallet ကို lock လုပ်ပြီး select
      const walletRes = await client.query(
        "SELECT * FROM wallets WHERE user_email=$1 FOR UPDATE",
        [tx.user_email]
      );

      if (!walletRes.rows.length) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      const wallet = walletRes.rows[0];
      if (Number(wallet.balance) < Number(tx.amount)) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Wallet balance လျော့
      await client.query(
        "UPDATE wallets SET balance = balance - $1 WHERE user_email=$2",
        [Number(tx.amount), tx.user_email]
      );

      // Transaction ကို Completed လို့ update
      await client.query(
        "UPDATE transactions SET status='Completed' WHERE id=$1",
        [id]
      );

      res.json({ message: "Order confirmed and balance deducted" });
    });
  } catch (err) {
    console.error("Order confirm error:", err);
    res.status(500).json({ error: "Failed to confirm order" });
  }
});


/* ---------------- Admin: Approve deposit (credit balance) ---------------- */
// Admin approves a deposit: marks transaction Completed and credits wallet
app.post("/api/deposit/approve/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await withClient(async (client) => {
      const txr = await client.query("SELECT * FROM transactions WHERE id=$1 FOR UPDATE", [id]);
      if (!txr.rows.length) throw { status: 404, message: "Transaction not found" };
      const tx = txr.rows[0];
      if (tx.type !== "deposit") throw { status: 400, message: "Not a deposit transaction" };
      if (tx.status !== "Pending") throw { status: 400, message: "Only Pending deposit can be approved" };

      const wr = await client.query("SELECT * FROM wallets WHERE user_email=$1 FOR UPDATE", [tx.user_email]);
      if (!wr.rows.length) throw { status: 404, message: "Wallet not found" };

      // credit wallet
      await client.query("UPDATE wallets SET balance = balance + $1 WHERE user_email = $2", [Number(tx.amount), tx.user_email]);

      await client.query("UPDATE transactions SET status='Completed' WHERE id=$1", [id]);
    });

    res.json({ message: "Deposit approved and wallet credited" });
  } catch (err) {
    console.error("Deposit approve error:", err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Approve failed" });
  }
});

/*******************************
 * 🎁 Gift Lucky Spin Section
 *******************************/

const router = express.Router();

// 🎁 ဆုတွေ - Special users only get big prizes
const BIG_PRIZES = [
  "iPhone 16",
  "Diamond 10,000",
  "UC 1000",
  "Ks-10000",
  "Ks-5000",
  "Ks-3000",
  "Ks-2000",
  "Ks-1000"
];

// 🎁 ဆုတွေ - Normal users get small prizes only
const NORMAL_PRIZES = [
  "Ks-100",
  "Ks-50", 
  "Ks-30",
  "Ks-10",
  "Good Luck",
  "Try Again",
  "Better Luck Next Time",
];

// 🎯 အထူး user email တွေ - Only these users can win big prizes
const SPECIAL_WIN_EMAILS = [
  "adminadmin@admin",
  "vipuser@gmail.com",
  "special@example.com"
];

// ✅ User Spin Gift
router.post("/api/gift/spin", async (req, res) => {
  const { userEmail } = req.body;
  if (!userEmail) return res.status(400).json({ error: "Missing email" });

  try {
    // Get user_id from email
    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = userResult.rows[0].id;

    // Check if user has tokens or free spin available
    const wallet = await pool.query(
      `SELECT tokens FROM wallets WHERE user_email = $1`,
      [userEmail]
    );

    if (!wallet.rows.length) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const userTokens = wallet.rows[0].tokens || 0;

    // Check for free spin (once per 24 hours)
    const lastGiftResult = await pool.query(
      `SELECT created_at FROM transactions 
       WHERE user_email = $1 AND type = 'gift' 
       ORDER BY created_at DESC LIMIT 1`,
      [userEmail]
    );

    let freeSpinAvailable = true;
    let nextFreeSpinTime = null;
    
    if (lastGiftResult.rows.length > 0) {
      const lastGiftTime = new Date(lastGiftResult.rows[0].created_at);
      const now = new Date();
      const hoursDiff = (now - lastGiftTime) / (1000 * 60 * 60);
      freeSpinAvailable = hoursDiff >= 24; // 24 hours cooldown for free spin
      
      if (!freeSpinAvailable) {
        // Calculate next free spin time (24 hours from last gift)
        nextFreeSpinTime = new Date(lastGiftTime.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    // Check if user can spin (has tokens OR free spin available)
    if (userTokens <= 0 && !freeSpinAvailable) {
      return res.status(400).json({ 
        error: "No tokens available. Buy tokens or wait for free spin tomorrow.",
        nextFreeSpin: nextFreeSpinTime ? nextFreeSpinTime.toISOString() : null
      });
    }

    // Deduct token only if user has tokens and is not using free spin
    if (userTokens > 0 && freeSpinAvailable) {
      // User has both tokens and free spin - use free spin first
      console.log("Using free spin (user also has tokens)");
    } else if (userTokens > 0 && !freeSpinAvailable) {
      // User only has tokens, no free spin - deduct token
      await pool.query(
        `UPDATE wallets SET tokens = tokens - 1 WHERE user_email = $1`,
        [userEmail]
      );
      console.log("Deducted token for spin");
    } else if (userTokens <= 0 && freeSpinAvailable) {
      // User only has free spin - use it
      console.log("Using free spin (no tokens)");
    }

    // Check if user is special (can win big prizes)
    const isSpecialUser = SPECIAL_WIN_EMAILS.includes(userEmail.toLowerCase());
    console.log(`Gift spin for ${userEmail} - Special user: ${isSpecialUser}`);
    
    let prize;
    if (isSpecialUser) {
      // Special users can win both big and normal prizes
      const allPrizes = [...BIG_PRIZES, ...NORMAL_PRIZES];
      prize = allPrizes[Math.floor(Math.random() * allPrizes.length)];
      console.log(`Special user won: ${prize} (from ${allPrizes.length} total prizes)`);
    } else {
      // Normal users see big prizes on wheel but only get small prizes
      // They have a 70% chance of getting small prizes, 30% chance of "Good Luck"
      const random = Math.random();
      if (random < 0.7) {
        // Give them a small prize
        prize = NORMAL_PRIZES[Math.floor(Math.random() * (NORMAL_PRIZES.length - 1))]; // Exclude "Better Luck Next Time"
        console.log(`Normal user won small prize: ${prize} (70% chance)`);
      } else {
        // Give them "Good Luck" message
        prize = "Good Luck";
        console.log(`Normal user got: ${prize} (30% chance)`);
      }
    }

    // Calculate prize amount based on prize won
    let prizeAmount = 0;
    let transactionAmount = 0;
    
    if (prize.startsWith("Ks-")) {
      prizeAmount = parseInt(prize.replace("Ks-", ""));
      transactionAmount = prizeAmount;
    } else if (prize === "Diamond 10,000") {
      prizeAmount = 10000;
      transactionAmount = 0; // Show as special prize, not amount
    } else if (prize === "UC 1000") {
      prizeAmount = 0; // UC prize, no balance change
      transactionAmount = 0; // Show as special prize, not amount
    } else if (prize === "iPhone 16") {
      prizeAmount = 0; // Physical prize, no balance change
      transactionAmount = 0; // Show as special prize, not amount
    }
    
    // Add prize amount to balance if it's a cash prize
    if (prizeAmount > 0) {
      await pool.query(
        `UPDATE wallets SET balance = balance + $1 WHERE user_email = $2`,
        [prizeAmount, userEmail]
      );
      console.log(`Added ${prizeAmount}Ks to balance for prize: ${prize}`);
    }
    
    // Insert transaction with prize name as remark
    await pool.query(
      `INSERT INTO transactions (user_id, user_email, type, status, amount, remark)
       VALUES ($1, $2, 'gift', 'Completed', $3, $4)`,
      [userId, userEmail, transactionAmount, prize]
    );
    console.log(`Gift transaction created: ${prize} (${transactionAmount}Ks)`);

    res.json({ prize });
  } catch (err) {
    console.error("Gift spin error:", err);
    res.status(500).json({ error: "Gift spin failed" });
  }
});

// ✅ Debug endpoint to check prize configuration
router.get("/api/gift/debug", (req, res) => {
  res.json({
    bigPrizes: BIG_PRIZES,
    normalPrizes: NORMAL_PRIZES,
    specialEmails: SPECIAL_WIN_EMAILS,
    totalBigPrizes: BIG_PRIZES.length,
    totalNormalPrizes: NORMAL_PRIZES.length,
    totalPrizes: BIG_PRIZES.length + NORMAL_PRIZES.length
  });
});

// ✅ User Gift Spin State
router.get("/api/gift/state/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const result = await pool.query(
      `SELECT created_at FROM transactions 
       WHERE user_email=$1 AND type='gift' 
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    let freeSpin = true;
    let remaining_time = 0;
    
    if (result.rows.length > 0) {
      const lastSpin = new Date(result.rows[0].created_at);
      const now = new Date();
      const timeDiff = now - lastSpin;
      
      if (timeDiff < 24 * 60 * 60 * 1000) {
        freeSpin = false;
        // Calculate remaining time in seconds
        const nextFreeTime = new Date(lastSpin.getTime() + 24 * 60 * 60 * 1000);
        remaining_time = Math.max(0, Math.floor((nextFreeTime.getTime() - now.getTime()) / 1000));
      }
    }

    const tokenRes = await pool.query(
      `SELECT tokens FROM wallets WHERE user_email=$1`,
      [email]
    );
    const tokens = tokenRes.rows.length ? tokenRes.rows[0].tokens : 0;

    res.json({ 
      freeSpin, 
      tokens,
      remaining_time
    });
  } catch (err) {
    console.error("Gift state error:", err);
    res.status(500).json({ error: "Failed to load state" });
  }
});

// ✅ Buy Token
router.post("/api/gift/buy-token", async (req, res) => {
  const { userEmail } = req.body;
  if (!userEmail) return res.status(400).json({ error: "Missing email" });

  try {
    // Get user_id from email
    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = userResult.rows[0].id;

    const wallet = await pool.query(
      `SELECT balance FROM wallets WHERE user_email=$1`,
      [userEmail]
    );

    if (!wallet.rows.length) return res.status(404).json({ error: "Wallet not found" });
    if (wallet.rows[0].balance < 500) return res.status(400).json({ error: "Not enough balance" });

    await pool.query(
      `UPDATE wallets SET balance = balance - 500, tokens = tokens + 1 WHERE user_email=$1`,
      [userEmail]
    );

    await pool.query(
      `INSERT INTO transactions (user_id, user_email, type, status, amount, remark)
       VALUES ($1, $2, 'gift-token', 'Completed', -500, 'Buy Gift Token')`,
      [userId, userEmail]
    );
    console.log(`Token purchase transaction created: -500Ks for ${userEmail}`);

    res.json({ message: "Token purchased successfully" });
  } catch (err) {
    console.error("Gift buy token error:", err);
    res.status(500).json({ error: "Failed to buy token" });
  }
});

// ✅ Gift History
router.get("/api/gift/history/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, remark, status, created_at 
       FROM transactions 
       WHERE user_email=$1 AND type='gift'
       ORDER BY created_at DESC LIMIT 20`,
      [email]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Gift history error:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

// ✅ Claim Free Token (after 24-hour countdown)
router.post("/api/gift/claim-free-token", async (req, res) => {
  const { userEmail } = req.body;
  if (!userEmail) return res.status(400).json({ error: "Missing email" });

  try {
    // Get user_id from email
    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = userResult.rows[0].id;

    // Check if user is eligible for free token (24 hours since last gift)
    const lastGiftResult = await pool.query(
      `SELECT created_at FROM transactions 
       WHERE user_email = $1 AND type = 'gift' 
       ORDER BY created_at DESC LIMIT 1`,
      [userEmail]
    );

    let eligibleForFreeToken = true;
    if (lastGiftResult.rows.length > 0) {
      const lastGiftTime = new Date(lastGiftResult.rows[0].created_at);
      const now = new Date();
      const hoursDiff = (now - lastGiftTime) / (1000 * 60 * 60);
      eligibleForFreeToken = hoursDiff >= 24;
    }

    if (!eligibleForFreeToken) {
      return res.status(400).json({ 
        error: "Not eligible for free token yet. Wait 24 hours since last gift." 
      });
    }

    // Add 1 free token to user's wallet
    await pool.query(
      `UPDATE wallets SET tokens = tokens + 1 WHERE user_email = $1`,
      [userEmail]
    );

    // Record the free token transaction
    await pool.query(
      `INSERT INTO transactions (user_id, user_email, type, status, amount, remark)
       VALUES ($1, $2, 'free-token', 'Completed', 0, '24-hour free token')`,
      [userId, userEmail]
    );

    res.json({ 
      message: "Free token claimed successfully!",
      tokens: 1
    });
  } catch (err) {
    console.error("Claim free token error:", err);
    res.status(500).json({ error: "Failed to claim free token" });
  }
});

// router ကို app ထဲ register
app.use(router);


/* ----------------- START ----------------- */
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));