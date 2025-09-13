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

  // Validate and sanitize amount
  const amountNum = Number(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    console.log("❌ Validation failed: Invalid amount", { amount, amountNum });
    return res.status(400).json({ error: "Invalid amount: must be a positive number" });
  }

  // Set reasonable limits for deposit amounts
  const MIN_DEPOSIT = 100;  // Minimum 100 Ks
  const MAX_DEPOSIT = 1000000;  // Maximum 1,000,000 Ks
  
  if (amountNum < MIN_DEPOSIT) {
    console.log("❌ Validation failed: Amount too small", { amount: amountNum, min: MIN_DEPOSIT });
    return res.status(400).json({ error: `Minimum deposit amount is ${MIN_DEPOSIT} Ks` });
  }
  
  if (amountNum > MAX_DEPOSIT) {
    console.log("❌ Validation failed: Amount too large", { amount: amountNum, max: MAX_DEPOSIT });
    return res.status(400).json({ error: `Maximum deposit amount is ${MAX_DEPOSIT} Ks` });
  }

  console.log("✅ Amount validation passed:", { original: amount, sanitized: amountNum });

  try {
    // Get user email from user_id
    const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [user_id]);
    if (userResult.rows.length === 0) {
      console.log("❌ User not found for ID:", user_id);
      return res.status(404).json({ error: "User not found" });
    }
    const user_email = userResult.rows[0].email;
    console.log("✅ User email found:", user_email);

    // Create transaction with sanitized amount
    const tx = await pool.query(
      `INSERT INTO transactions (user_id,user_email,amount,type,status,method,remark,screenshot,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
      [user_id, user_email, amountNum, "deposit", "Pending", method, remark || null, screenshot]
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
 * 📱 Telegram Authentication
 *******************************/

// Store pending login requests (in production, use Redis or database)
const pendingLogins = new Map();

// Telegram Bot API configuration
const TELEGRAM_BOT_TOKEN = "8256194856:AAGqJPELBjSovJtQqnfOni4CuNa6HX1Xy_I";
const TELEGRAM_BOT_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Generate random security code
function generateSecurityCode() {
  return Math.floor(1000000 + Math.random() * 9000000);
}

// Send login request to user via Telegram bot
async function sendTelegramLoginRequest(telegramUserId, securityCode) {
  try {
    const message = `🔐 **Login Request for Arthur Game Shop**\n\n` +
                   `Security Code: \`${securityCode}\`\n\n` +
                   `If you requested this login, please confirm below:`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirm Login", callback_data: `confirm_${securityCode}` },
          { text: "❌ Decline", callback_data: `decline_${securityCode}` }
        ]
      ]
    };
    
    const response = await fetch(`${TELEGRAM_BOT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramUserId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      })
    });
    
    const result = await response.json();
    console.log("📱 Telegram login request sent:", result);
    return result.ok;
  } catch (error) {
    console.error("❌ Failed to send Telegram login request:", error);
    return false;
  }
}

// Handle Telegram bot webhook for login confirmations
app.post("/api/telegram-webhook", express.json(), async (req, res) => {
  try {
    const { callback_query } = req.body;
    
    if (!callback_query) {
      return res.status(200).send("OK");
    }
    
    const { data, from, message } = callback_query;
    const telegramUserId = from.id;
    const username = from.username;
    const firstName = from.first_name;
    const lastName = from.last_name || '';
    
    console.log("📱 Telegram callback received:", { data, telegramUserId, username });
    
    if (data.startsWith('confirm_')) {
      const securityCode = data.replace('confirm_', '');
      const loginData = pendingLogins.get(securityCode);
      
      if (loginData && loginData.telegramUserId === telegramUserId) {
        // Login confirmed - create or update user
        const fullName = `${firstName} ${lastName}`.trim();
        const email = `telegram_${telegramUserId}@arthur-gameshop.com`;
        
        // Check if user exists
        const existingUser = await pool.query(
          "SELECT * FROM users WHERE telegram_id = $1", 
          [telegramUserId.toString()]
        );
        
        let user;
        
        if (existingUser.rows.length > 0) {
          // Update existing user
          user = existingUser.rows[0];
          await pool.query(
            "UPDATE users SET first_name = $1, last_name = $2, username = $3, updated_at = NOW() WHERE telegram_id = $4",
            [firstName, lastName, username, telegramUserId.toString()]
          );
        } else {
          // Create new user
          const newUser = await pool.query(
            "INSERT INTO users (name, email, telegram_id, first_name, last_name, username, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *",
            [fullName, email, telegramUserId.toString(), firstName, lastName, username]
          );
          
          user = newUser.rows[0];
          
          // Create wallet for new user
          await pool.query(
            "INSERT INTO wallets (user_id, user_name, user_email, balance, tokens, created_at) VALUES ($1, $2, $3, 0, 0, NOW())",
            [user.id, user.name, user.email]
          );
        }
        
        // Generate JWT token
        const token = jwt.sign(
          { 
            userId: user.id, 
            email: user.email, 
            name: user.name,
            telegramId: user.telegram_id 
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        // Update login status
        loginData.status = 'confirmed';
        loginData.user = user;
        loginData.token = token;
        
        // Send confirmation message
        await fetch(`${TELEGRAM_BOT_URL}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callback_query.id,
            text: "✅ Login confirmed! You can now return to the website.",
            show_alert: true
          })
        });
        
        // Update the message
        await fetch(`${TELEGRAM_BOT_URL}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramUserId,
            message_id: message.message_id,
            text: `✅ **Login Confirmed!**\n\nWelcome to Arthur Game Shop, ${firstName}!\n\nYou can now return to the website.`,
            parse_mode: 'Markdown'
          })
        });
        
        console.log("✅ Login confirmed for user:", user.email);
      } else {
        await fetch(`${TELEGRAM_BOT_URL}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callback_query.id,
            text: "❌ Invalid or expired login request.",
            show_alert: true
          })
        });
      }
    } else if (data.startsWith('decline_')) {
      const securityCode = data.replace('decline_', '');
      const loginData = pendingLogins.get(securityCode);
      
      if (loginData && loginData.telegramUserId === telegramUserId) {
        loginData.status = 'declined';
        
        await fetch(`${TELEGRAM_BOT_URL}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callback_query.id,
            text: "❌ Login declined.",
            show_alert: true
          })
        });
        
        await fetch(`${TELEGRAM_BOT_URL}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramUserId,
            message_id: message.message_id,
            text: `❌ **Login Declined**\n\nLogin request has been declined.`,
            parse_mode: 'Markdown'
          })
        });
        
        console.log("❌ Login declined for user:", telegramUserId);
      }
    }
    
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Telegram webhook error:", error);
    res.status(500).send("Error");
  }
});

// Start Telegram login process
app.post("/api/telegram-login-start", async (req, res) => {
  try {
    const { telegramUserId } = req.body;
    
    if (!telegramUserId) {
      return res.status(400).json({ error: "Telegram user ID is required" });
    }
    
    // Generate security code
    const securityCode = generateSecurityCode();
    
    // Store pending login
    pendingLogins.set(securityCode, {
      telegramUserId: telegramUserId.toString(),
      securityCode,
      status: 'pending',
      createdAt: new Date()
    });
    
    // Send login request via Telegram bot
    const sent = await sendTelegramLoginRequest(telegramUserId, securityCode);
    
    if (sent) {
      res.json({ 
        success: true, 
        message: "Login request sent to your Telegram",
        securityCode 
      });
    } else {
      res.status(500).json({ error: "Failed to send login request" });
    }
  } catch (error) {
    console.error("❌ Telegram login start error:", error);
    res.status(500).json({ error: "Failed to start login process" });
  }
});

// Check login status
app.get("/api/telegram-login-status/:securityCode", async (req, res) => {
  try {
    const { securityCode } = req.params;
    const loginData = pendingLogins.get(securityCode);
    
    if (!loginData) {
      return res.status(404).json({ error: "Login request not found" });
    }
    
    // Clean up expired requests (older than 5 minutes)
    if (new Date() - loginData.createdAt > 5 * 60 * 1000) {
      pendingLogins.delete(securityCode);
      return res.status(410).json({ error: "Login request expired" });
    }
    
    if (loginData.status === 'confirmed') {
      // Clean up the pending login
      pendingLogins.delete(securityCode);
      
      res.json({
        success: true,
        status: 'confirmed',
        user: loginData.user,
        token: loginData.token
      });
    } else if (loginData.status === 'declined') {
      pendingLogins.delete(securityCode);
      res.json({
        success: false,
        status: 'declined'
      });
    } else {
      res.json({
        success: false,
        status: 'pending'
      });
    }
  } catch (error) {
    console.error("❌ Check login status error:", error);
    res.status(500).json({ error: "Failed to check login status" });
  }
});

// Handle login confirmation from Telegram bot
app.post("/api/telegram-login-confirm", async (req, res) => {
  try {
    const { securityCode, telegramUserId, firstName, username, chatId } = req.body;
    
    console.log("🤖 Bot login confirmation received:", { securityCode, telegramUserId, firstName });
    
    // Find the pending login
    const loginData = pendingLogins.get(securityCode);
    
    if (!loginData || loginData.telegramUserId !== telegramUserId) {
      return res.status(404).json({ error: "Invalid or expired login request" });
    }
    
    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE telegram_id = $1", 
      [telegramUserId]
    );
    
    let user;
    
    if (existingUser.rows.length > 0) {
      // Update existing user
      user = existingUser.rows[0];
      await pool.query(
        "UPDATE users SET first_name = $1, username = $2, updated_at = NOW() WHERE telegram_id = $3",
        [firstName, username, telegramUserId]
      );
      console.log("✅ Updated existing user:", user.email);
    } else {
      // Create new user
      const fullName = firstName;
      const email = `telegram_${telegramUserId}@arthur-gameshop.com`;
      
      const newUser = await pool.query(
        "INSERT INTO users (name, email, telegram_id, first_name, username, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *",
        [fullName, email, telegramUserId, firstName, username]
      );
      
      user = newUser.rows[0];
      
      // Create wallet for new user
      await pool.query(
        "INSERT INTO wallets (user_id, user_name, user_email, balance, tokens, created_at) VALUES ($1, $2, $3, 0, 0, NOW())",
        [user.id, user.name, user.email]
      );
      
      console.log("✅ Created new user:", user.email);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        name: user.name,
        telegramId: user.telegram_id 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Update login data
    loginData.status = 'confirmed';
    loginData.user = user;
    loginData.token = token;
    
    res.json({
      success: true,
      user: user,
      token: token
    });
    
  } catch (error) {
    console.error("❌ Bot login confirmation error:", error);
    res.status(500).json({ error: "Failed to confirm login" });
  }
});

// Get user info by Telegram ID (for bot balance command)
app.get("/api/telegram-user-info/:telegramUserId", async (req, res) => {
  try {
    const { telegramUserId } = req.params;
    
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.telegram_id, u.first_name, u.username,
             COALESCE(w.balance, 0) as balance, COALESCE(w.tokens, 0) as tokens
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.telegram_id = $1
    `, [telegramUserId]);
    
    if (result.rows.length > 0) {
      res.json({
        success: true,
        user: result.rows[0]
      });
    } else {
      res.json({
        success: false,
        error: "User not found"
      });
    }
    
  } catch (error) {
    console.error("❌ Get user info error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

// Telegram auth verification function
function checkTelegramAuth(data, botToken) {
  const hash = data.hash;
  delete data.hash;
  
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const dataCheckString = Object.keys(data).sort().map(key => `${key}=${data[key]}`).join('\n');
  const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  
  return calculatedHash === hash;
}

// Store pending confirmation codes
const pendingConfirmations = new Map();

// Telegram authentication callback with verification
app.get("/api/telegram-auth-callback", async (req, res) => {
  console.log("=== TELEGRAM AUTH CALLBACK ===");
  console.log("Query params:", req.query);
  
  const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.query;
  
  // Verify the authentication data
  if (!id || !first_name || !auth_date || !hash) {
    console.log("❌ Missing required Telegram auth data");
    return res.status(400).send(`
      <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
            <h2 style="color: #e74c3c;">Authentication Failed</h2>
            <p>Invalid authentication data received from Telegram.</p>
            <a href="/login.html" style="color: #3498db; text-decoration: none;">← Back to Login</a>
          </div>
        </body>
      </html>
    `);
  }
  
  // Verify Telegram authentication hash
  const authData = { id, first_name, last_name, username, photo_url, auth_date, hash };
  if (!checkTelegramAuth(authData, TELEGRAM_BOT_TOKEN)) {
    console.log("❌ Invalid Telegram authentication hash");
    return res.status(400).send(`
      <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
            <h2 style="color: #e74c3c;">Authentication Failed</h2>
            <p>Invalid authentication signature from Telegram.</p>
            <a href="/login.html" style="color: #3498db; text-decoration: none;">← Back to Login</a>
          </div>
        </body>
      </html>
    `);
  }
  
  try {
    // Generate confirmation code
    const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store pending confirmation
    pendingConfirmations.set(confirmationCode, {
      telegramUserId: id,
      firstName: first_name,
      lastName: last_name || '',
      username: username || '',
      photoUrl: photo_url || '',
      authDate: auth_date,
      createdAt: new Date()
    });
    
    console.log("📱 Telegram auth verified, confirmation code generated:", confirmationCode);
    
    // Send confirmation code via Telegram bot
    try {
      const message = `🔐 **Arthur Game Shop Login Confirmation**\n\n` +
                     `Hello ${first_name}!\n\n` +
                     `Your login confirmation code is:\n` +
                     `\`${confirmationCode}\`\n\n` +
                     `Please enter this code on the website to complete your login.\n\n` +
                     `This code will expire in 5 minutes.`;
      
      const response = await fetch(`${TELEGRAM_BOT_URL}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: id,
          text: message,
          parse_mode: 'Markdown'
        })
      });
      
      const result = await response.json();
      console.log("📱 Confirmation code sent:", result.ok ? "Success" : "Failed");
    } catch (error) {
      console.error("❌ Failed to send confirmation code:", error);
    }
    
    // Return confirmation code page
    res.send(`
      <html>
        <head>
          <title>Confirmation Code Sent</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0; 
              padding: 0; 
              min-height: 100vh; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
            }
            .confirmation-container { 
              background: white; 
              padding: 40px; 
              border-radius: 15px; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.3); 
              text-align: center; 
              max-width: 400px; 
              width: 90%;
            }
            .confirmation-icon { 
              font-size: 60px; 
              color: #0088cc; 
              margin-bottom: 20px; 
            }
            h2 { 
              color: #333; 
              margin-bottom: 15px; 
            }
            p { 
              color: #666; 
              margin-bottom: 25px; 
              line-height: 1.5; 
            }
            .code-display { 
              background: #f8f9fa; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0; 
              border: 2px solid #0088cc;
              font-family: 'Courier New', monospace;
              font-size: 24px;
              font-weight: bold;
              color: #0088cc;
            }
            .instructions {
              background: #e3f2fd;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #0088cc;
            }
            .back-link {
              color: #0088cc;
              text-decoration: none;
              font-weight: 500;
            }
            .back-link:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="confirmation-container">
            <div class="confirmation-icon">📱</div>
            <h2>Confirmation Code Sent!</h2>
            <p>Hello ${first_name}! We've sent a confirmation code to your Telegram.</p>
            
            <div class="code-display">
              ${confirmationCode}
            </div>
            
            <div class="instructions">
              <strong>Next Steps:</strong><br>
              1. Check your Telegram for the confirmation code<br>
              2. Return to the website<br>
              3. Enter the code to complete your login
            </div>
            
            <p style="font-size: 14px; color: #999;">
              This code will expire in 5 minutes.
            </p>
            
            <a href="/login.html" class="back-link">← Back to Login</a>
          </div>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error("❌ Telegram auth error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      query: req.query
    });
    
    res.status(500).send(`
      <html>
        <head><title>Authentication Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
            <h2 style="color: #e74c3c;">Authentication Error</h2>
            <p>Sorry, there was an error processing your Telegram login. Please try again.</p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              Error: ${error.message}
            </p>
            <a href="/login.html" style="color: #3498db; text-decoration: none;">← Back to Login</a>
          </div>
        </body>
      </html>
    `);
  }
});

// Verify confirmation code
app.post("/api/telegram-verify-code", async (req, res) => {
  try {
    const { confirmationCode } = req.body;
    
    if (!confirmationCode) {
      return res.status(400).json({ error: "Confirmation code is required" });
    }
    
    const confirmationData = pendingConfirmations.get(confirmationCode);
    
    if (!confirmationData) {
      return res.status(404).json({ error: "Invalid or expired confirmation code" });
    }
    
    // Check if code is expired (5 minutes)
    if (new Date() - confirmationData.createdAt > 5 * 60 * 1000) {
      pendingConfirmations.delete(confirmationCode);
      return res.status(410).json({ error: "Confirmation code has expired" });
    }
    
    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE telegram_id = $1", 
      [confirmationData.telegramUserId]
    );
    
    let user;
    
    if (existingUser.rows.length > 0) {
      // Update existing user
      user = existingUser.rows[0];
      await pool.query(
        "UPDATE users SET first_name = $1, last_name = $2, username = $3, photo_url = $4, updated_at = NOW() WHERE telegram_id = $5",
        [confirmationData.firstName, confirmationData.lastName, confirmationData.username, confirmationData.photoUrl, confirmationData.telegramUserId]
      );
      console.log("✅ Updated existing user:", user.email);
    } else {
      // Create new user
      const fullName = `${confirmationData.firstName} ${confirmationData.lastName}`.trim();
      const email = `telegram_${confirmationData.telegramUserId}@arthur-gameshop.com`;
      
      const newUser = await pool.query(
        "INSERT INTO users (name, email, telegram_id, first_name, last_name, username, photo_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *",
        [fullName, email, confirmationData.telegramUserId, confirmationData.firstName, confirmationData.lastName, confirmationData.username, confirmationData.photoUrl]
      );
      
      user = newUser.rows[0];
      
      // Create wallet for new user
      await pool.query(
        "INSERT INTO wallets (user_id, user_name, user_email, balance, tokens, created_at) VALUES ($1, $2, $3, 0, 0, NOW())",
        [user.id, user.name, user.email]
      );
      
      console.log("✅ Created new user:", user.email);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        name: user.name,
        telegramId: user.telegram_id 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Clean up confirmation code
    pendingConfirmations.delete(confirmationCode);
    
    res.json({
      success: true,
      user: user,
      token: token
    });
    
  } catch (error) {
    console.error("❌ Verify confirmation code error:", error);
    res.status(500).json({ error: "Failed to verify confirmation code" });
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

// Create transaction audit log table if it doesn't exist
async function createTransactionAuditTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transaction_audit_log (
        id SERIAL PRIMARY KEY,
        transaction_id INTEGER NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        field_name VARCHAR(50),
        old_value TEXT,
        new_value TEXT,
        admin_email VARCHAR(255),
        admin_token VARCHAR(500),
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Transaction audit log table created/verified");
  } catch (err) {
    console.error("❌ Error creating audit table:", err);
  }
}

// Initialize audit table
createTransactionAuditTable();

// Function to log transaction changes
async function logTransactionChange(transactionId, userEmail, action, fieldName, oldValue, newValue, adminToken, req) {
  try {
    const adminEmail = adminToken ? 'admin@admin.xyz1#' : 'system';
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await pool.query(`
      INSERT INTO transaction_audit_log 
      (transaction_id, user_email, action, field_name, old_value, new_value, admin_email, admin_token, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [transactionId, userEmail, action, fieldName, oldValue, newValue, adminEmail, adminToken, ipAddress, userAgent]);
    
    console.log(`📝 Audit log: ${action} on transaction ${transactionId} - ${fieldName}: ${oldValue} → ${newValue}`);
  } catch (err) {
    console.error("❌ Error logging transaction change:", err);
  }
}

// ✅ Debug endpoint to view transaction audit logs
router.get("/api/debug/audit/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const auditLogs = await pool.query(
      "SELECT * FROM transaction_audit_log WHERE transaction_id = $1 ORDER BY created_at DESC",
      [transactionId]
    );
    
    res.json({
      transactionId,
      auditLogs: auditLogs.rows,
      totalChanges: auditLogs.rows.length
    });
  } catch (err) {
    console.error("Debug audit error:", err);
    res.status(500).json({ error: "Debug failed" });
  }
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
             u.telegram_id, u.first_name, u.last_name, u.username, u.photo_url,
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
             u.telegram_id, u.first_name, u.last_name, u.username, u.photo_url,
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
  const { status, amount, type, method, phone, recipient, remark } = req.body;
  
  try {
    // First, get the transaction details to check if it's a deposit
    const txResult = await pool.query("SELECT * FROM transactions WHERE id = $1", [id]);
    if (!txResult.rows.length) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    
    const transaction = txResult.rows[0];
    
    // FIXED: Deposit confirmation with database trigger workaround
    if (status === 'Completed' && transaction.type === 'deposit' && transaction.status === 'Pending') {
      console.log(`🔧 DEPOSIT APPROVAL WITH TRIGGER WORKAROUND - Transaction ${id}`);
      console.log(`- Amount: ${transaction.amount} Ks`);
      console.log(`- User: ${transaction.user_email}`);
      
      // Use atomic transaction to prevent double processing
      await withClient(async (client) => {
        // Lock the transaction row to prevent double processing
        const lockedTx = await client.query("SELECT * FROM transactions WHERE id = $1 FOR UPDATE", [id]);
        if (!lockedTx.rows.length) {
          throw new Error(`Transaction ${id} not found`);
        }
        
        const lockedTransaction = lockedTx.rows[0];
        
        // Double-check if this transaction was already processed
        if (lockedTransaction.status === 'Completed') {
          console.log(`⚠️ Transaction ${id} already completed - skipping`);
          return;
        }
        
        // Get current wallet balance
        const currentWallet = await client.query("SELECT balance FROM wallets WHERE user_email = $1", [transaction.user_email]);
        const currentBalance = Number(currentWallet.rows[0]?.balance || 0);
        console.log(`- Current balance: ${currentBalance} Ks`);
        
        const depositAmount = Number(transaction.amount);
        
        // WORKAROUND: Subtract the amount first to counteract database trigger
        console.log(`- Step 1: Subtracting ${depositAmount} Ks to counteract database trigger`);
        await client.query("UPDATE wallets SET balance = balance - $1 WHERE user_email = $2", 
          [depositAmount, transaction.user_email]);
        
        // Update transaction status - this will trigger the database trigger
        console.log(`- Step 2: Updating transaction status to Completed (triggers database trigger)`);
        await client.query("UPDATE transactions SET status = 'Completed' WHERE id = $1", [id]);
        
        // The database trigger will add the amount back, resulting in correct balance
        console.log(`- Step 3: Database trigger will add ${depositAmount} Ks back`);
        
        // Verify the final balance
        const finalWallet = await client.query("SELECT balance FROM wallets WHERE user_email = $1", [transaction.user_email]);
        const finalBalance = Number(finalWallet.rows[0]?.balance || 0);
        const actualIncrease = finalBalance - currentBalance;
        
        console.log(`- Expected increase: ${depositAmount} Ks`);
        console.log(`- Actual increase: ${actualIncrease} Ks`);
        console.log(`- Final balance: ${finalBalance} Ks`);
        
        if (actualIncrease !== depositAmount) {
          console.log(`⚠️ Balance mismatch: expected +${depositAmount}, got +${actualIncrease}`);
          // If there's still a mismatch, manually correct it
          const correction = depositAmount - actualIncrease;
          if (correction !== 0) {
            console.log(`- Correcting balance by ${correction} Ks`);
            await client.query("UPDATE wallets SET balance = balance + $1 WHERE user_email = $2", 
              [correction, transaction.user_email]);
          }
        }
        
        console.log(`✅ Deposit ${id} approved: +${depositAmount} Ks`);
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
        
        // Log the tampering attempt
        await logTransactionChange(id, transaction.user_email, 'TAMPERING_ATTEMPT', 'amount', 
          transaction.amount.toString(), amount.toString(), req.headers.authorization, req);
      } else {
        await pool.query("UPDATE transactions SET amount = $1 WHERE id = $2", [amount, id]);
        console.log(`✅ Amount updated for transaction ${id}: ${amount}`);
        
        // Log legitimate amount change
        await logTransactionChange(id, transaction.user_email, 'AMOUNT_UPDATE', 'amount', 
          transaction.amount.toString(), amount.toString(), req.headers.authorization, req);
      }
    }
    
    if (type) {
      await pool.query("UPDATE transactions SET type = $1 WHERE id = $2", [type, id]);
    }
    
    if (method !== undefined) {
      await pool.query("UPDATE transactions SET method = $1 WHERE id = $2", [method, id]);
    }
    
    if (phone !== undefined) {
      await pool.query("UPDATE transactions SET phone = $1 WHERE id = $2", [phone, id]);
    }
    
    if (recipient !== undefined) {
      await pool.query("UPDATE transactions SET recipient = $1 WHERE id = $2", [recipient, id]);
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

// Initialize Telegram columns in users table
async function initializeTelegramColumns() {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(50) UNIQUE,
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS username VARCHAR(255),
      ADD COLUMN IF NOT EXISTS photo_url TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    console.log("✅ Telegram columns initialized in users table");
  } catch (error) {
    console.log("ℹ️ Telegram columns initialization:", error.message);
  }
}

// Initialize Telegram columns on startup
initializeTelegramColumns();

// Set up Telegram bot webhook
async function setupTelegramWebhook() {
  try {
    const webhookUrl = `${process.env.NODE_ENV === "production" 
      ? "https://arthur-game-shop.onrender.com" 
      : "https://your-ngrok-url.ngrok.io"}/api/telegram-webhook`;
    
    const response = await fetch(`${TELEGRAM_BOT_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    
    const result = await response.json();
    console.log("📱 Telegram webhook setup:", result);
  } catch (error) {
    console.log("ℹ️ Telegram webhook setup:", error.message);
  }
}

// Set up webhook on startup
setupTelegramWebhook();

/* ----------------- START ----------------- */
app.listen(PORT, () => {
  const serverUrl = process.env.NODE_ENV === "production" 
    ? "https://arthur-game-shop.onrender.com"
    : `http://localhost:${PORT}`;
  console.log(`Server running on ${serverUrl}`);
});