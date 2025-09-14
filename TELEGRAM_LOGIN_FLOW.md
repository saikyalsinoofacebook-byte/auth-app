# 🔐 Telegram Login Flow Documentation

## ✅ Complete Flow Overview

### 1. **User Login Process**

#### **Method 1: Telegram Login Widget (Primary)**
1. **User clicks "Login with Telegram" button** on login/register page
2. **Redirected to Telegram** for authentication
3. **Returns to website** with verified Telegram data
4. **Server generates 6-digit confirmation code**
5. **Bot sends code to user's Telegram**
6. **User enters code on website**
7. **User is logged in and redirected to home.html**

#### **Method 2: Bot Login (Alternative)**
1. **User clicks "Login via Bot" button**
2. **Shows instructions** to use @arthur_gameshopbot
3. **User sends `/login` to bot**
4. **Bot sends confirmation code**
5. **User enters code on website**
6. **User is logged in and redirected to home.html**

### 2. **Database Storage**

#### **User Data Saved:**
```sql
-- Users table
INSERT INTO users (
  name,                    -- Full name from Telegram
  email,                   -- Generated: telegram_{id}@arthur-gameshop.com
  telegram_id,             -- Telegram user ID
  first_name,              -- Telegram first name
  last_name,               -- Telegram last name
  username,                -- Telegram username
  photo_url,               -- Telegram profile photo
  created_at               -- Registration timestamp
) VALUES (...);

-- Wallets table
INSERT INTO wallets (
  user_id,                 -- Reference to users.id
  user_name,               -- User's name
  user_email,              -- User's email
  balance,                 -- Initial balance: 0
  tokens,                  -- Initial tokens: 0
  created_at               -- Creation timestamp
) VALUES (...);
```

### 3. **Admin Panel Integration**

#### **Users Display:**
- ✅ **Telegram users shown** with Telegram icon
- ✅ **Username displayed** as @username
- ✅ **All user data** including Telegram info
- ✅ **Balance and tokens** from wallet
- ✅ **Registration date** and user details

#### **Admin Features:**
- ✅ **View user details** including Telegram info
- ✅ **Edit user information**
- ✅ **Delete users**
- ✅ **View wallet balances**
- ✅ **Transaction history**

### 4. **Security Features**

#### **Authentication Verification:**
```javascript
function checkTelegramAuth(data, botToken) {
  const hash = data.hash;
  delete data.hash;
  
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const dataCheckString = Object.keys(data).sort().map(key => `${key}=${data[key]}`).join('\n');
  const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  
  return calculatedHash === hash;
}
```

#### **Confirmation Code System:**
- **6-digit random codes** (100000-999999)
- **5-minute expiration** time
- **One-time use** (deleted after verification)
- **JWT tokens** for session management

### 5. **API Endpoints**

#### **Telegram Authentication:**
- `GET /api/telegram-auth-callback` - Handles widget authentication
- `POST /api/telegram-verify-code` - Verifies confirmation codes
- `POST /api/telegram-login-start` - Starts bot login process
- `GET /api/telegram-login-status/:code` - Checks login status

#### **Admin Panel:**
- `GET /api/admin/users` - Get all users (includes Telegram data)
- `GET /api/admin/users/:id` - Get specific user details
- `PUT /api/admin/users/:id` - Update user information
- `DELETE /api/admin/users/:id` - Delete user

### 6. **Frontend Integration**

#### **Login Page (login.html):**
```html
<!-- Telegram Login Widget -->
<script async src="https://telegram.org/js/telegram-widget.js?15"
        data-telegram-login="arthur_gameshopbot"
        data-size="large"
        data-userpic="false"
        data-auth-url="https://arthur-game-shop.onrender.com/api/telegram-auth-callback"
        data-request-access="write">
</script>

<!-- Alternative Bot Login -->
<button id="telegramBotLoginBtn" class="telegram-bot-login-btn">
  <i class="bi bi-robot"></i>
  Login via Bot (Alternative)
</button>
```

#### **JavaScript (app.js):**
```javascript
// Confirmation code verification
const response = await fetch(`${backendURL}/api/telegram-verify-code`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirmationCode: code })
});

if (data.success) {
  // Store user data
  localStorage.setItem("user", data.user.name);
  localStorage.setItem("email", data.user.email);
  localStorage.setItem("token", data.token);
  localStorage.setItem("telegramId", data.user.telegram_id);
  
  // Redirect to home page
  window.location.href = "home.html";
}
```

### 7. **Bot Commands**

#### **@arthur_gameshopbot Commands:**
- `/start` - Welcome message and instructions
- `/login` - Generate login request with confirmation code
- `/balance` - Check account balance (for registered users)
- `/help` - Show available commands

### 8. **Database Schema**

#### **Users Table:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  telegram_id VARCHAR(50),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  username VARCHAR(255),
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **Wallets Table:**
```sql
CREATE TABLE wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  balance DECIMAL(10,2) DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  onhold DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 9. **Testing Instructions**

#### **Local Testing:**
1. **Start server:** `node server.js`
2. **Start bot:** `node telegram-bot.js`
3. **Open:** `http://localhost:5000/login.html`
4. **Test login flow** with Telegram widget or bot

#### **Production Testing:**
1. **Deploy to Render** (server should auto-deploy)
2. **Test live site:** `https://arthur-game-shop.onrender.com/login.html`
3. **Verify admin panel:** `https://arthur-game-shop.onrender.com/admin/`

### 10. **Troubleshooting**

#### **Common Issues:**
- **502 Bad Gateway:** Server crashed due to missing imports (FIXED)
- **Missing packages:** Run `npm install jsonwebtoken`
- **Database errors:** Check DATABASE_URL environment variable
- **Bot not responding:** Check bot token and webhook setup

#### **Debug Steps:**
1. Check server logs for errors
2. Verify database connection
3. Test API endpoints individually
4. Check Telegram bot status
5. Verify admin authentication

## ✅ Status: FULLY FUNCTIONAL

The complete Telegram login system is working with:
- ✅ User registration and login
- ✅ Database storage
- ✅ Admin panel integration
- ✅ Security verification
- ✅ Home page redirect
- ✅ Mobile responsive design
