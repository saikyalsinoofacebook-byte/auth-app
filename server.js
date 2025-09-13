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

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === "production" 
    ? ["https://arthur-game-shop.onrender.com", "https://arthur-game-shop.onrender.com/"]
    : true, // Allow all origins in development
  credentials: true
};
app.use(cors(corsOptions));
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

// Admin routes
app.get("/admin", (req, res) => res.redirect("/admin/login.html"));
app.get("/admin/", (req, res) => res.redirect("/admin/login.html"));
app.get("/admin/index.html", (req, res) => res.redirect("/admin/login.html"));

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

    console.log(`👤 NEW USER REGISTERED: ${email} - ${name}`);
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

    console.log(`🔑 USER LOGIN: ${email}`);
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
    console.log(`💰 DEPOSIT REQUEST: ${user_email} - ${amount} Ks via ${method}`);
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
// DISABLED: This endpoint is replaced by the admin panel transaction update endpoint
// to prevent double processing of deposits
app.post("/api/deposit/approve/:id", async (req, res) => {
  console.log("⚠️ WARNING: Old deposit approval endpoint called - this should not happen!");
  console.log("Use PUT /api/admin/transactions/:id instead");
  res.status(410).json({ 
    error: "This endpoint is deprecated. Use PUT /api/admin/transactions/:id instead",
    message: "Please use the admin panel to approve deposits"
  });
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
      console.log(`🎁 GIFT SPIN DEBUG:`);
      console.log(`- User: ${userEmail}`);
      console.log(`- Prize: ${prize}`);
      console.log(`- Prize Amount: ${prizeAmount} Ks`);
      
      // Get current balance before adding prize
      const currentWallet = await pool.query("SELECT balance FROM wallets WHERE user_email = $1", [userEmail]);
      const currentBalance = currentWallet.rows[0]?.balance || 0;
      console.log(`- Current Balance: ${currentBalance} Ks`);
      
      await pool.query(
        `UPDATE wallets SET balance = balance + $1 WHERE user_email = $2`,
        [prizeAmount, userEmail]
      );
      
      // Get new balance after adding prize
      const newWallet = await pool.query("SELECT balance FROM wallets WHERE user_email = $1", [userEmail]);
      const newBalance = newWallet.rows[0]?.balance || 0;
      console.log(`- New Balance: ${newBalance} Ks`);
      console.log(`- Balance Increase: ${newBalance - currentBalance} Ks`);
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

// ✅ Debug endpoint to check user wallet and transaction history
router.get("/api/debug/user/:email", async (req, res) => {
  const { email } = req.params;
  try {
    // Get user wallet
    const wallet = await pool.query("SELECT * FROM wallets WHERE user_email = $1", [email]);
    
    // Get all transactions for this user
    const transactions = await pool.query(
      "SELECT id, type, amount, status, remark, created_at FROM transactions WHERE user_email = $1 ORDER BY created_at DESC",
      [email]
    );
    
    // Calculate total money added from deposits
    const depositTotal = transactions.rows
      .filter(tx => tx.type === 'deposit' && tx.status === 'Completed')
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    
    // Calculate total money added from gifts
    const giftTotal = transactions.rows
      .filter(tx => tx.type === 'gift' && tx.status === 'Completed')
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    
    res.json({
      email,
      wallet: wallet.rows[0] || null,
      transactions: transactions.rows,
      totals: {
        depositTotal,
        giftTotal,
        expectedBalance: depositTotal + giftTotal
      }
    });
  } catch (err) {
    console.error("Debug user error:", err);
    res.status(500).json({ error: "Debug failed" });
  }
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

// ======================
// ADMIN ROUTES
// ======================

// Simple admin authentication (in production, use proper JWT)
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || "admin@admin.xyz1#",
  password: process.env.ADMIN_PASSWORD || "@@admin.221233"
};

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "No token provided" });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString('ascii');
    const [username, timestamp] = decoded.split(':');
    
    if (username === ADMIN_CREDENTIALS.username) {
      req.adminUser = { username };
      next();
    } else {
      res.status(401).json({ error: "Invalid token" });
    }
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Health check endpoint
router.get("/health", async (req, res) => {
  try {
    // Test database connection
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ 
      status: 'OK', 
      database: 'Connected',
      timestamp: result.rows[0].current_time,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'Disconnected',
      error: err.message 
    });
  }
});

// Test endpoint with mock data (no database required)
router.get("/api/admin/test-data", authenticateAdmin, async (req, res) => {
  try {
    console.log('Test data endpoint called');
    
    // Return mock data for testing
    const mockData = {
      users: [
        { id: 1, name: 'Test User 1', email: 'user1@test.com', balance: 1000, tokens: 5, created_at: new Date().toISOString() },
        { id: 2, name: 'Test User 2', email: 'user2@test.com', balance: 2500, tokens: 10, created_at: new Date().toISOString() },
        { id: 3, name: 'Test User 3', email: 'user3@test.com', balance: 500, tokens: 2, created_at: new Date().toISOString() }
      ],
      orders: [
        { order_id: 'ORD001', user_email: 'user1@test.com', item_details: 'MLBB Diamonds', price: 1000, status: 'Completed', created_at: new Date().toISOString() },
        { order_id: 'ORD002', user_email: 'user2@test.com', item_details: 'PUBG UC', price: 500, status: 'Pending', created_at: new Date().toISOString() }
      ],
      transactions: [
        { id: 1, user_email: 'user1@test.com', type: 'deposit', amount: 1000, status: 'Completed', created_at: new Date().toISOString() },
        { id: 2, user_email: 'user2@test.com', type: 'withdraw', amount: 500, status: 'Pending', created_at: new Date().toISOString() }
      ],
      wallets: [
        { user_email: 'user1@test.com', balance: 1000, onhold: 0, tokens: 5, name: 'Test User 1' },
        { user_email: 'user2@test.com', balance: 2500, onhold: 100, tokens: 10, name: 'Test User 2' }
      ]
    };
    
    res.json(mockData);
  } catch (err) {
    console.error('Test data error:', err);
    res.status(500).json({ error: "Failed to fetch test data" });
  }
});

// Admin login
router.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Admin login attempt:', { username, password: password ? '***' : 'empty' });
  
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    // Simple token (in production, use JWT)
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    console.log('Admin login successful, token generated');
    res.json({ token, message: "Admin login successful" });
  } else {
    console.log('Admin login failed - invalid credentials');
    res.status(401).json({ error: "Invalid admin credentials" });
  }
});

// Verify admin token
router.get("/api/admin/verify", async (req, res) => {
  const authHeader = req.headers.authorization;
  console.log('Admin verify request:', { authHeader: authHeader ? 'present' : 'missing' });
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No valid auth header');
    return res.status(401).json({ error: "No token provided" });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString('ascii');
    const [username, timestamp] = decoded.split(':');
    
    console.log('Token decoded:', { username, timestamp });
    
    if (username === ADMIN_CREDENTIALS.username) {
      console.log('Token verification successful');
      res.json({ valid: true, success: true });
    } else {
      console.log('Token verification failed - username mismatch');
      res.status(401).json({ error: "Invalid token" });
    }
  } catch (error) {
    console.log('Token verification error:', error.message);
    res.status(401).json({ error: "Invalid token" });
  }
});

// Get single user details (for editing)
router.get("/api/admin/users/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.password, u.created_at, 
             COALESCE(w.balance, 0) as balance, COALESCE(w.tokens, 0) as tokens
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Get all users
router.get("/api/admin/users", authenticateAdmin, async (req, res) => {
  try {
    console.log('Admin users endpoint called');
    
    // First, let's check if the users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    console.log('Users table exists:', tableCheck.rows[0].exists);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Users table does not exist!');
      return res.status(500).json({ error: "Users table does not exist" });
    }
    
    // Check if wallets table exists
    const walletsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'wallets'
      );
    `);
    console.log('Wallets table exists:', walletsCheck.rows[0].exists);
    
    // Try a simple query first
    const simpleResult = await pool.query('SELECT COUNT(*) FROM users');
    console.log('Users count:', simpleResult.rows[0].count);
    
    // Now try the full query - FIXED FOR RAILWAY DATABASE
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.created_at, 
             COALESCE(w.balance, 0) as balance, COALESCE(w.tokens, 0) as tokens
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      ORDER BY u.created_at DESC
    `);
    
    console.log('Users query successful, found:', result.rows.length, 'users');
    res.json(result.rows);
  } catch (err) {
    console.error("Admin users error:", err);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint
    });
    res.status(500).json({ 
      error: "Failed to fetch users",
      details: err.message,
      code: err.code
    });
  }
});

// Update user
router.put("/api/admin/users/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, password, balance, tokens } = req.body;
  
  try {
    // Check if user exists
    const userRes = await pool.query("SELECT email FROM users WHERE id = $1", [id]);
    if (!userRes.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const oldEmail = userRes.rows[0].email;
    
    // Update user details
    if (password) {
      // Hash password if provided
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        "UPDATE users SET name = $1, email = $2, password = $3 WHERE id = $4",
        [name, email, hashedPassword, id]
      );
    } else {
      // Update without password
      await pool.query(
        "UPDATE users SET name = $1, email = $2 WHERE id = $3",
        [name, email, id]
      );
    }
    
    // Update wallet using the new email
    await pool.query(
      "UPDATE wallets SET user_email = $1, balance = $2, tokens = $3 WHERE user_email = $4",
      [email, balance, tokens, oldEmail]
    );
    
    res.json({ success: true, message: "User updated successfully" });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user", details: err.message });
  }
});

// Delete user
router.delete("/api/admin/users/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get user email first
    const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const userEmail = userResult.rows[0].email;
    
    // Delete from all related tables (CASCADE should handle this, but being explicit)
    await pool.query("DELETE FROM transactions WHERE user_email = $1", [userEmail]);
    await pool.query("DELETE FROM wallets WHERE user_email = $1", [userEmail]);
    await pool.query("DELETE FROM orders WHERE user_email = $1", [userEmail]);
    await pool.query("DELETE FROM gift_tokens WHERE user_email = $1", [userEmail]);
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// Get all orders
router.get("/api/admin/orders", authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, u.name as user_name
      FROM orders o
      LEFT JOIN users u ON o.user_email = u.email
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Admin orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Update order status
router.put("/api/admin/orders/:orderId", authenticateAdmin, async (req, res) => {
  const { orderId } = req.params;
  const { status, price, gameId, serverId } = req.body;
  
  try {
    if (status) {
      await pool.query("UPDATE orders SET status = $1 WHERE order_id = $2", [status, orderId]);
    }
    
    if (price !== undefined) {
      await pool.query("UPDATE orders SET price = $1 WHERE order_id = $2", [price, orderId]);
    }
    
    if (gameId) {
      await pool.query("UPDATE orders SET game_id = $1 WHERE order_id = $2", [gameId, orderId]);
    }
    
    if (serverId) {
      await pool.query("UPDATE orders SET server_id = $1 WHERE order_id = $2", [serverId, orderId]);
    }
    
    res.json({ success: true, message: "Order updated successfully" });
  } catch (err) {
    console.error("Update order error:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// Get all transactions
router.get("/api/admin/transactions", authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.email as user_email
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Admin transactions error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Update transaction status
router.put("/api/admin/transactions/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, amount, type, method, remark } = req.body;
  
  try {
    // First, get the transaction details to check if it's a deposit
    const txResult = await pool.query("SELECT * FROM transactions WHERE id = $1", [id]);
    if (!txResult.rows.length) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    
    const transaction = txResult.rows[0];
    
    // If updating status to 'Completed' and it's a deposit, handle wallet balance update
    if (status === 'Completed' && transaction.type === 'deposit' && transaction.status === 'Pending') {
      console.log(`🔍 DEPOSIT APPROVAL DEBUG:`);
      console.log(`- Transaction ID: ${id}`);
      console.log(`- Transaction Amount: ${transaction.amount}`);
      console.log(`- User Email: ${transaction.user_email}`);
      console.log(`- Current Status: ${transaction.status}`);
      console.log(`- Request Body:`, req.body);
      console.log(`- Request Headers:`, req.headers);
      
      await withClient(async (client) => {
        // Lock the transaction row to prevent double processing
        const lockedTx = await client.query("SELECT * FROM transactions WHERE id = $1 FOR UPDATE", [id]);
        if (!lockedTx.rows.length) {
          console.log(`❌ Transaction ${id} not found during lock`);
          return;
        }
        
        const lockedTransaction = lockedTx.rows[0];
        
        // Check if this transaction was already processed
        if (lockedTransaction.status === 'Completed') {
          console.log(`⚠️ WARNING: Transaction ${id} already completed! Skipping wallet update.`);
          return;
        }
        
        // Get current wallet balance before update
        const currentWallet = await client.query("SELECT balance FROM wallets WHERE user_email = $1", [transaction.user_email]);
        const currentBalance = currentWallet.rows[0]?.balance || 0;
        console.log(`- Current Wallet Balance: ${currentBalance}`);
        
        // Update transaction status
        await client.query("UPDATE transactions SET status = $1 WHERE id = $2", [status, id]);
        console.log(`- Transaction status updated to: ${status}`);
        
        // Update wallet balance for deposit
        const depositAmount = Number(transaction.amount);
        console.log(`- Adding to wallet: ${depositAmount}`);
        
        await client.query("UPDATE wallets SET balance = balance + $1 WHERE user_email = $2", 
          [depositAmount, transaction.user_email]);
        
        // Get new wallet balance after update
        const newWallet = await client.query("SELECT balance FROM wallets WHERE user_email = $1", [transaction.user_email]);
        const newBalance = newWallet.rows[0]?.balance || 0;
        console.log(`- New Wallet Balance: ${newBalance}`);
        console.log(`- Balance Increase: ${newBalance - currentBalance}`);
        
        // Check for any other pending deposits for this user
        const otherDeposits = await client.query(
          "SELECT id, amount, status FROM transactions WHERE user_email = $1 AND type = 'deposit' AND status = 'Pending'",
          [transaction.user_email]
        );
        console.log(`- Other pending deposits for ${transaction.user_email}:`, otherDeposits.rows);
        
        // Log all transactions for this user to debug
        const allUserTxs = await client.query(
          "SELECT id, type, amount, status, created_at FROM transactions WHERE user_email = $1 ORDER BY created_at DESC LIMIT 10",
          [transaction.user_email]
        );
        console.log(`- All recent transactions for ${transaction.user_email}:`, allUserTxs.rows);
      });
    } else {
      // For non-deposit transactions or other status updates, just update the transaction
      if (status) {
        await pool.query("UPDATE transactions SET status = $1 WHERE id = $2", [status, id]);
      }
    }
    
    // Handle other field updates
    if (amount !== undefined) {
      // Security: Do not allow amount changes for deposit transactions
      if (transaction.type === 'deposit') {
        console.log(`🔒 SECURITY: Amount change blocked for deposit transaction ${id}. Original amount: ${transaction.amount}, Requested amount: ${amount}`);
        console.log(`🔒 SECURITY: Deposit amounts cannot be modified to prevent fraud. Only status can be changed.`);
      } else {
        await pool.query("UPDATE transactions SET amount = $1 WHERE id = $2", [amount, id]);
        console.log(`✅ Amount updated for transaction ${id}: ${amount}`);
      }
    }
    
    if (type) {
      await pool.query("UPDATE transactions SET type = $1 WHERE id = $2", [type, id]);
    }
    
    if (method) {
      await pool.query("UPDATE transactions SET method = $1 WHERE id = $2", [method, id]);
    }
    
    if (remark !== undefined) {
      await pool.query("UPDATE transactions SET remark = $1 WHERE id = $2", [remark, id]);
    }
    
    res.json({ success: true, message: "Transaction updated successfully" });
  } catch (err) {
    console.error("Update transaction error:", err);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

// Get all wallets
router.get("/api/admin/wallets", authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, u.name
      FROM wallets w
      LEFT JOIN users u ON w.user_id = u.id
      ORDER BY w.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Admin wallets error:", err);
    res.status(500).json({ error: "Failed to fetch wallets" });
  }
});

// Update wallet
router.put("/api/admin/wallets/:userEmail", authenticateAdmin, async (req, res) => {
  const { userEmail } = req.params;
  const { balance, available, onhold, tokens } = req.body;
  
  try {
    if (balance !== undefined) {
      await pool.query("UPDATE wallets SET balance = $1 WHERE user_email = $2", [balance, userEmail]);
    }
    
    if (available !== undefined) {
      await pool.query("UPDATE wallets SET available = $1 WHERE user_email = $2", [available, userEmail]);
    }
    
    if (onhold !== undefined) {
      await pool.query("UPDATE wallets SET onhold = $1 WHERE user_email = $2", [onhold, userEmail]);
    }
    
    if (tokens !== undefined) {
      await pool.query("UPDATE wallets SET tokens = $1 WHERE user_email = $2", [tokens, userEmail]);
    }
    
    res.json({ success: true, message: "Wallet updated successfully" });
  } catch (err) {
    console.error("Update wallet error:", err);
    res.status(500).json({ error: "Failed to update wallet" });
  }
});

// Add funds to wallet
router.post("/api/admin/wallets/:userEmail/add-funds", authenticateAdmin, async (req, res) => {
  const { userEmail } = req.params;
  const { amount, reason, notes } = req.body;
  
  try {
    // Get current balance
    const walletResult = await pool.query("SELECT balance FROM wallets WHERE user_email = $1", [userEmail]);
    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    
    const currentBalance = walletResult.rows[0].balance || 0;
    const newBalance = currentBalance + parseFloat(amount);
    
    // Update wallet balance
    await pool.query("UPDATE wallets SET balance = $1 WHERE user_email = $2", [newBalance, userEmail]);
    
    // Create transaction record
    await pool.query(`
      INSERT INTO transactions (user_id, user_email, amount, type, status, method, remark, created_at)
      VALUES (
        (SELECT id FROM users WHERE email = $1),
        $1, $2, 'deposit', 'Completed', 'admin_adjustment', $3, CURRENT_TIMESTAMP
      )
    `, [userEmail, amount, `Admin added funds: ${reason}. ${notes || ''}`]);
    
    res.json({ message: "Funds added successfully" });
  } catch (err) {
    console.error("Add funds error:", err);
    res.status(500).json({ error: "Failed to add funds" });
  }
});

// Add tokens to wallet
router.post("/api/admin/wallets/:userEmail/add-tokens", authenticateAdmin, async (req, res) => {
  const { userEmail } = req.params;
  const { amount, reason, notes } = req.body;
  
  try {
    // Get current tokens
    const walletResult = await pool.query("SELECT tokens FROM wallets WHERE user_email = $1", [userEmail]);
    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    
    const currentTokens = walletResult.rows[0].tokens || 0;
    const newTokens = currentTokens + parseInt(amount);
    
    // Update wallet tokens
    await pool.query("UPDATE wallets SET tokens = $1 WHERE user_email = $2", [newTokens, userEmail]);
    
    // Create transaction record
    await pool.query(`
      INSERT INTO transactions (user_id, user_email, amount, type, status, method, remark, created_at)
      VALUES (
        (SELECT id FROM users WHERE email = $1),
        $1, 0, 'gift-token', 'Completed', 'admin_gift', $3, CURRENT_TIMESTAMP
      )
    `, [userEmail, `Admin added ${amount} tokens: ${reason}. ${notes || ''}`]);
    
    res.json({ message: "Tokens added successfully" });
  } catch (err) {
    console.error("Add tokens error:", err);
    res.status(500).json({ error: "Failed to add tokens" });
  }
});

// Get gift transactions
router.get("/api/admin/gifts", authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.email as user_email
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.type = 'gift' OR t.type = 'gift-token'
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Admin gifts error:", err);
    res.status(500).json({ error: "Failed to fetch gifts" });
  }
});

// Update admin settings
router.put("/api/admin/settings", authenticateAdmin, async (req, res) => {
  const { freeTokenInterval, tokenPrice } = req.body;
  
  try {
    // In a real app, you'd store these in a settings table
    // For now, just return success
    res.json({ 
      message: "Settings updated",
      settings: { freeTokenInterval, tokenPrice }
    });
  } catch (err) {
    console.error("Update settings error:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// router ကို app ထဲ register
app.use(router);


/* ----------------- START ----------------- */
app.listen(PORT, () => {
  const serverUrl = process.env.NODE_ENV === "production" 
    ? "https://arthur-game-shop.onrender.com"
    : `http://localhost:${PORT}`;
  console.log(`Server running on ${serverUrl}`);
});