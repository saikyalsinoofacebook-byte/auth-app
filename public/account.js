function goToDeposit() {
  window.location.href = "deposit.html";
}

function goToOrders() {
  window.location.href = "orders.html";
}

function goToWallet() {
  window.location.href = "wallet.html";
}

function goToSettings() {
  window.location.href = "settings.html";
}

function goToTelegram() {
  window.location.href = "https://t.me/YourAdminLink"; // Admin Telegram link
}
// User Data Load
const USER = JSON.parse(localStorage.getItem("user"));

if (!USER) {
  alert("ကျေးဇူးပြု၍ Login ဝင်ပါ");
  window.location.href = "login.html";
} else {
  document.getElementById("username").innerText = USER.username || "User";
  document.getElementById("useremail").innerText = USER.email || "";
}



// Balance ကို API ကနေ ယူမယ်
async function loadBalance() {
  try {
    const res = await fetch(`http://localhost:5000/api/wallet/${USER.email}`);
    const data = await res.json();
    if (res.ok) {
      document.getElementById("balance").innerText = data.balance.toLocaleString() + " ကျပ်";
    } else {
      document.getElementById("balance").innerText = "0.00 ကျပ်";
    }
  } catch (err) {
    console.error("Balance load error:", err);
    document.getElementById("balance").innerText = "0.00 ကျပ်";
  }
}
loadBalance();

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

  try {
    const res = await fetch("http://localhost:5000/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: USER.email, code })
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
  try {
    await fetch(`http://localhost:5000/api/clear/${USER.email}`, { method: "DELETE" });
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
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

// Redeem Modal
function openRedeem() {
  document.getElementById("redeemModal").style.display = "flex";
}
function closeRedeem() {
  document.getElementById("redeemModal").style.display = "none";
}
function redeem() {
  const code = document.getElementById("redeemCode").value;
  if (code === "WELCOME10") {
    alert("You got 1000 Ks bonus!");
    // Transaction history + balance update API call ထပ်ရေးနိုင်တယ်
  } else {
    alert("Invalid code!");
  }
  closeRedeem();
}

// Clear Data Modal
function openClear() {
  document.getElementById("clearModal").style.display = "flex";
}
function closeClear() {
  document.getElementById("clearModal").style.display = "none";
}
function clearData() {
  alert("All transactions cleared!");
  // API ဖျက်မယ်
  closeClear();
}

// Logout Modal
function openLogout() {
  document.getElementById("logoutModal").style.display = "flex";
}
function closeLogout() {
  document.getElementById("logoutModal").style.display = "none";
}
function logout() {
  window.location.href = "index.html";
}

// Highlight Account tab when on account.html
const accountNav = document.querySelector(".bottombar a[href='account.html']");
if (accountNav) {
  accountNav.classList.add("active");
}
