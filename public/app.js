// public/app.js
console.log("Arthur Game Shop App Loaded ✅");

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("regForm");
  const telegramLoginBtn = document.getElementById("telegramLoginBtn");
  const telegramLoginStatus = document.getElementById("telegramLoginStatus");
  const securityCodeDisplay = document.getElementById("securityCodeDisplay");

  const backendURL = "https://arthur-game-shop.onrender.com";

  // ---------------- Telegram Bot Login ----------------
  const telegramBotLoginBtn = document.getElementById("telegramBotLoginBtn");
  const telegramBotLoginStatus = document.getElementById("telegramBotLoginStatus");
  const confirmationCodeDisplay = document.getElementById("confirmationCodeDisplay");
  
  if (telegramBotLoginBtn) {
    telegramBotLoginBtn.addEventListener("click", async () => {
      try {
        // Show instructions for bot login
        const instructions = `🤖 **Telegram Bot Login**\n\n` +
          `To login with Telegram:\n\n` +
          `1. Open your Telegram app\n` +
          `2. Search for: @arthur_gameshopbot\n` +
          `3. Start a chat with the bot\n` +
          `4. Send: /login\n` +
          `5. Click "Confirm Login" in the bot\n` +
          `6. Return here and enter your Telegram User ID\n\n` +
          `Get your User ID from @userinfobot if needed.`;
        
        if (confirm(instructions)) {
          const telegramUserId = prompt("Please enter your Telegram User ID:");
          if (telegramUserId) {
            await startTelegramBotLogin(telegramUserId);
          }
        }
      } catch (error) {
        console.error("Telegram bot login error:", error);
        alert("❌ Telegram bot login failed: " + error.message);
      }
    });
  }
  
  // ---------------- Confirmation Code Verification ----------------
  const confirmationCodeInput = document.getElementById("confirmationCodeInput");
  const verifyCodeBtn = document.getElementById("verifyCodeBtn");
  
  if (verifyCodeBtn) {
    verifyCodeBtn.addEventListener("click", async () => {
      const code = confirmationCodeInput?.value?.trim();
      if (!code) {
        alert("Please enter the confirmation code");
        return;
      }
      
      try {
        const response = await fetch(`${backendURL}/api/telegram-verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmationCode: code })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Store user data
          localStorage.setItem("user", data.user.name);
          localStorage.setItem("email", data.user.email);
          localStorage.setItem("token", data.token);
          localStorage.setItem("telegramId", data.user.telegram_id);
          
          alert("✅ Login successful! Welcome to Arthur Game Shop!");
          window.location.href = "home.html";
        } else {
          alert("❌ " + (data.error || "Invalid confirmation code"));
        }
      } catch (error) {
        console.error("Verify code error:", error);
        alert("❌ Failed to verify code: " + error.message);
      }
    });
  }

  async function startTelegramBotLogin(telegramUserId) {
    try {
      // Show loading status
      telegramBotLoginBtn.style.display = 'none';
      telegramBotLoginStatus.style.display = 'block';
      
      // Start login process
      const response = await fetch(`${backendURL}/api/telegram-login-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Show security code
        confirmationCodeDisplay.textContent = data.securityCode;
        
        // Start polling for login status
        pollBotLoginStatus(data.securityCode);
      } else {
        throw new Error(data.error || 'Failed to start login process');
      }
    } catch (error) {
      console.error("Start Telegram bot login error:", error);
      alert("❌ Failed to start Telegram bot login: " + error.message);
      resetTelegramBotLoginUI();
    }
  }

  async function pollLoginStatus(securityCode) {
    const maxAttempts = 60; // 5 minutes (5 seconds * 60)
    let attempts = 0;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const response = await fetch(`${backendURL}/api/telegram-login-status/${securityCode}`);
        const data = await response.json();
        
        if (data.success && data.status === 'confirmed') {
          // Login successful
          clearInterval(pollInterval);
          
          // Store user data
          localStorage.setItem("user", data.user.name);
          localStorage.setItem("email", data.user.email);
          localStorage.setItem("token", data.token);
          localStorage.setItem("telegramId", data.user.telegram_id);
          
          // Show success message
          showLoginSuccess(data.user);
          
          // Redirect after 2 seconds
          setTimeout(() => {
            window.location.href = "home.html";
          }, 2000);
          
        } else if (data.status === 'declined') {
          // Login declined
          clearInterval(pollInterval);
          alert("❌ Login was declined. Please try again.");
          resetTelegramLoginUI();
          
        } else if (attempts >= maxAttempts) {
          // Timeout
          clearInterval(pollInterval);
          alert("⏰ Login request expired. Please try again.");
          resetTelegramLoginUI();
        }
        
      } catch (error) {
        console.error("Poll login status error:", error);
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          alert("❌ Login check failed. Please try again.");
          resetTelegramLoginUI();
        }
      }
    }, 5000); // Poll every 5 seconds
  }

  function showLoginSuccess(user) {
    telegramLoginStatus.innerHTML = `
      <div class="status-message" style="color: #28a745;">
        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
        <p style="font-weight: bold; margin: 10px 0;">Login Successful!</p>
        <p>Welcome, ${user.name}!</p>
        <p style="font-size: 14px; color: #666;">Redirecting to your dashboard...</p>
      </div>
    `;
  }

  async function pollBotLoginStatus(securityCode) {
    const maxAttempts = 60; // 5 minutes (5 seconds * 60)
    let attempts = 0;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const response = await fetch(`${backendURL}/api/telegram-login-status/${securityCode}`);
        const data = await response.json();
        
        if (data.success && data.status === 'confirmed') {
          // Login successful
          clearInterval(pollInterval);
          
          // Store user data
          localStorage.setItem("user", data.user.name);
          localStorage.setItem("email", data.user.email);
          localStorage.setItem("token", data.token);
          localStorage.setItem("telegramId", data.user.telegram_id);
          
          // Show success message
          showBotLoginSuccess(data.user);
          
          // Redirect after 2 seconds
          setTimeout(() => {
            window.location.href = "home.html";
          }, 2000);
          
        } else if (data.status === 'declined') {
          // Login declined
          clearInterval(pollInterval);
          alert("❌ Login was declined. Please try again.");
          resetTelegramBotLoginUI();
          
        } else if (attempts >= maxAttempts) {
          // Timeout
          clearInterval(pollInterval);
          alert("⏰ Login request expired. Please try again.");
          resetTelegramBotLoginUI();
        }
        
      } catch (error) {
        console.error("Poll bot login status error:", error);
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          alert("❌ Login check failed. Please try again.");
          resetTelegramBotLoginUI();
        }
      }
    }, 5000); // Poll every 5 seconds
  }

  function showBotLoginSuccess(user) {
    telegramBotLoginStatus.innerHTML = `
      <div class="status-message" style="color: #28a745;">
        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
        <p style="font-weight: bold; margin: 10px 0;">Login Successful!</p>
        <p>Welcome, ${user.name}!</p>
        <p style="font-size: 14px; color: #666;">Redirecting to your dashboard...</p>
      </div>
    `;
  }

  function resetTelegramBotLoginUI() {
    telegramBotLoginBtn.style.display = 'flex';
    telegramBotLoginStatus.style.display = 'none';
    confirmationCodeDisplay.textContent = '';
  }

  function resetTelegramLoginUI() {
    telegramLoginBtn.style.display = 'flex';
    telegramLoginStatus.style.display = 'none';
    securityCodeDisplay.textContent = '';
  }

  // ---------------- Register ----------------
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("regName").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const pass = document.getElementById("regPassword").value.trim();

      try {
        const res = await fetch(`${backendURL}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password: pass })
        });

        const data = await res.json();
        if (res.ok) {
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("email", email); // Save email for gift system
          alert("✅ Registration successful!");
          window.location.href = "home.html";
        } else {
          alert("❌ " + data.error);
        }
      } catch (err) {
        alert("❌ Server error: " + err.message);
      }
    });
  }

  // ---------------- Login ----------------
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("logEmail").value.trim();
      const pass = document.getElementById("logPassword").value.trim();

      try {
        const res = await fetch(`${backendURL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass })
        });

        const data = await res.json();
        if (res.ok) {
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("email", email); // Save email for gift system
          alert("✅ Login successful!");
          window.location.href = "home.html";
        } else {
          alert("❌ " + data.error);
        }
      } catch (err) {
        alert("❌ Server error: " + err.message);
      }
    });
  }
});
