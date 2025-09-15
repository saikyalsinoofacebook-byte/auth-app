// User Data Load
const userStr = localStorage.getItem("user");
let USER = null;

if (!userStr) {
  alert("ကျေးဇူးပြု၍ Login ဝင်ပါ");
  window.location.href = "login.html";
} else {
  USER = JSON.parse(userStr);
  
  // Display username - prefer Telegram username, then first name, then name
  let displayName = "User";
  if (USER.telegram_username && USER.telegram_username !== '') {
    displayName = `@${USER.telegram_username}`;
  } else if (USER.first_name) {
    displayName = USER.first_name;
    if (USER.last_name) {
      displayName += ` ${USER.last_name}`;
    }
  } else if (USER.name) {
    displayName = USER.name;
  }
  
  document.getElementById("username").innerText = displayName;
  document.getElementById("useremail").innerText = USER.email || "";
  
  // Load balance after user data is set
  loadBalance();
}

// Balance ကို API ကနေ ယူမယ်
async function loadBalance() {
  if (!USER || !USER.id) {
    console.error("No user ID found");
    document.getElementById("balance").innerText = "0.00 ကျပ်";
    return;
  }

  try {
    console.log("🔄 Loading balance for user ID:", USER.id);
    const res = await fetch(`https://arthur-game-shop.onrender.com/api/wallet/${USER.id}`);
    const data = await res.json();
    console.log("💰 Balance response:", data);
    
    if (res.ok && data.balance !== undefined) {
      document.getElementById("balance").innerText = data.balance.toLocaleString() + " ကျပ်";
      console.log("✅ Balance loaded:", data.balance);
    } else {
      console.error("❌ Balance API error:", data);
      document.getElementById("balance").innerText = "0.00 ကျပ်";
    }
  } catch (err) {
    console.error("❌ Balance load error:", err);
    document.getElementById("balance").innerText = "0.00 ကျပ်";
  }
}

// Refresh balance function
async function refreshBalance() {
  const refreshBtn = document.getElementById("refreshBtn");
  const balanceElement = document.getElementById("balance");
  
  // Show loading state
  refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i>';
  balanceElement.innerText = "Loading...";
  
  // Disable button during loading
  refreshBtn.disabled = true;
  
  try {
    await loadBalance();
  } finally {
    // Re-enable button
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
  }
}

// Navigation Functions
function goToDeposit() { window.location.href = "deposit.html"; }
function goToOrders() { window.location.href = "orders.html"; }
function goToWallet() { window.location.href = "wallet.html"; }
function goToSettings() { window.location.href = "settings.html"; }
function goToTelegram() { window.location.href = "https://t.me/YourAdminLink"; }

// Redeem Modal
function openRedeem() { document.getElementById("redeemModal").style.display = "flex"; }
function closeRedeem() { document.getElementById("redeemModal").style.display = "none"; }

async function redeem() {
  const code = document.getElementById("redeemCode").value.trim();
  if (!code) return alert("Please enter code");

  if (!USER || !USER.id) {
    alert("User not found");
    return;
  }

  try {
    const res = await fetch("https://arthur-game-shop.onrender.com/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER.id, code })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Code Accepted! Bonus ${data.bonus} Ks`);
      loadBalance();
    } else {
      alert(data.error || "Invalid code");
    }
  } catch (err) {
    alert("Redeem error");
  }
  closeRedeem();
}

// Clear Data Modal
function openClear() { document.getElementById("clearModal").style.display = "flex"; }
function closeClear() { document.getElementById("clearModal").style.display = "none"; }

async function clearData() {
  if (!USER || !USER.id) {
    alert("User not found");
    return;
  }

  try {
    await fetch(`https://arthur-game-shop.onrender.com/api/clear/${USER.id}`, { method: "DELETE" });
    alert("All transactions cleared!");
    loadBalance();
  } catch (err) {
    alert("Clear failed");
  }
  closeClear();
}

// Logout Modal
function openLogout() { document.getElementById("logoutModal").style.display = "flex"; }
function closeLogout() { document.getElementById("logoutModal").style.display = "none"; }

function logout() {
  // Clear all user-related data from localStorage
  localStorage.removeItem("user");
  localStorage.removeItem("email");
  localStorage.removeItem("token");
  localStorage.removeItem("telegramId");
  localStorage.removeItem("telegramUsername");
  localStorage.removeItem("telegramFirstName");
  localStorage.removeItem("telegramLastName");
  localStorage.removeItem("userName");
  window.location.href = "index.html";
}

// Highlight Account tab when on account.html
const accountNav = document.querySelector(".bottombar a[href='account.html']");
if (accountNav) {
  accountNav.classList.add("active");
}
