// ======================
// Backend API base
// ======================
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : window.location.origin;

// ✅ LocalStorage ထဲက user info ယူ
const USER = JSON.parse(localStorage.getItem("user"));
const EMAIL = USER?.email || null;

// ✅ Debug user info
console.log("👤 User from localStorage:", USER);
console.log("📧 Email extracted:", EMAIL);

// ======================
// Wallet Load
// ======================
async function loadWallet() {
  if (!EMAIL) {
    console.warn("⚠️ No user email found in localStorage!");
    alert("⚠️ Please login first to view wallet");
    return;
  }

  try {
    console.log(`🔄 Loading wallet for: ${EMAIL}`);
    console.log(`🌐 API URL: ${API_BASE}/api/wallet/${EMAIL}`);
    
    const res = await fetch(`${API_BASE}/api/wallet/${EMAIL}`);
    console.log(`📡 Response status: ${res.status}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ API Error: ${res.status} - ${errorText}`);
      throw new Error(`Server error: ${res.status}`);
    }

    const wallet = await res.json();
    console.log("✅ Wallet data received:", wallet);

    document.getElementById("total-balance").textContent =
      Number(wallet.balance ?? 0).toFixed(2);
    document.getElementById("available").textContent =
      Number(wallet.balance ?? 0).toFixed(2);
    document.getElementById("onhold").textContent =
      Number(wallet.onhold ?? 0).toFixed(2);
  } catch (err) {
    console.error("❌ Wallet load error:", err);
    alert("❌ Wallet load error: " + err.message);
  }
}

// ======================
// Transactions Load
// ======================
async function loadTransactions() {
  if (!EMAIL) {
    console.warn("⚠️ No user email found for transactions!");
    return;
  }

  try {
    console.log(`🔄 Loading transactions for: ${EMAIL}`);
    console.log(`🌐 API URL: ${API_BASE}/api/transactions/${EMAIL}`);
    
    const res = await fetch(`${API_BASE}/api/transactions/${EMAIL}`);
    console.log(`📡 Response status: ${res.status}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ API Error: ${res.status} - ${errorText}`);
      throw new Error(`Server error: ${res.status}`);
    }

    const txns = await res.json();
    console.log("✅ Transactions data received:", txns);
    
    const txnList = document.getElementById("transactions-list");
    txnList.innerHTML = "";

    if (!txns || txns.length === 0) {
      txnList.innerHTML = "<p class='no-txn'>စာရင်းမရှိသေးပါ</p>";
      return;
    }

    txns.forEach((txn) => {
      const amountClass = txn.amount > 0 ? "positive" : "negative";

      // ✅ Status class mapping
      let statusClass = "status-pending";
      let statusText = "Unverified";

      if (txn.status) {
        const normalized = txn.status.toLowerCase();
        if (normalized === "completed" || normalized === "complete") {
          statusClass = "status-completed";
          statusText = "Completed";
        } else if (normalized === "pending") {
          statusClass = "status-pending";
          statusText = "Pending";
        } else if (normalized === "cancelled" || normalized === "canceled") {
          statusClass = "status-cancelled";
          statusText = "Cancelled";
        }
      }

      const card = document.createElement("div");
      card.className = "txn-card";
      card.innerHTML = `
        <div class="txn-left">
          <i class="bi bi-wallet2 icon"></i>
          <div>
            <strong>${txn.type || "Transaction"}</strong><br>
            <small>${
              txn.created_at
                ? new Date(txn.created_at).toLocaleString()
                : ""
            }</small><br>
            <span class="${statusClass}">${statusText}</span>
          </div>
        </div>
        <div class="txn-right ${amountClass}">
          ${txn.amount > 0 ? "+" : ""}${Number(txn.amount).toFixed(2)}
        </div>
      `;
      txnList.appendChild(card);
    });
  } catch (err) {
    console.error("❌ Transaction load error:", err);
    alert("❌ Transaction load error: " + err.message);
  }
}

// ======================
// Deposit API Call
// ======================
async function deposit(amount) {
  if (!EMAIL) return;

  try {
    const res = await fetch(`${API_BASE}/api/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, amount }),
    });

    const data = await res.json();
    if (res.ok) {
      alert("✅ Deposit successful");

      // ✅ Update wallet from response
      document.getElementById("total-balance").textContent =
        Number(data.wallet.balance).toFixed(2);
      document.getElementById("available").textContent =
        Number(data.wallet.balance).toFixed(2);
      document.getElementById("onhold").textContent =
        Number(data.wallet.onhold).toFixed(2);

      // ✅ Refresh transactions
      loadTransactions();
    } else {
      alert("❌ Deposit failed: " + data.error);
    }
  } catch (err) {
    console.error("Deposit error:", err);
    alert("Deposit error: " + err.message);
  }
}

// ======================
// Withdraw API Call
// ======================
async function withdraw(amount) {
  if (!EMAIL) return;

  try {
    const res = await fetch(`${API_BASE}/api/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, amount }),
    });

    const data = await res.json();
    if (res.ok) {
      alert("✅ Withdraw successful");

      // ✅ Update wallet from response
      document.getElementById("total-balance").textContent =
        Number(data.wallet.balance).toFixed(2);
      document.getElementById("available").textContent =
        Number(data.wallet.balance).toFixed(2);
      document.getElementById("onhold").textContent =
        Number(data.wallet.onhold).toFixed(2);

      // ✅ Refresh transactions
      loadTransactions();
    } else {
      alert("❌ Withdraw failed: " + data.error);
    }
  } catch (err) {
    console.error("Withdraw error:", err);
    alert("Withdraw error: " + err.message);
  }
}

// ======================
// ✅ Page open တုန်းမှာ Auto Load
// ======================
document.addEventListener("DOMContentLoaded", () => {
  // ✅ Check if user is logged in
  if (!EMAIL) {
    console.warn("⚠️ No user found, redirecting to login");
    alert("⚠️ Please login first to access wallet");
    window.location.href = "login.html";
    return;
  }

  loadWallet();
  loadTransactions();

  // Deposit button → deposit.html သွားမယ်
  const depositBtn = document.getElementById("deposit-btn");
  if (depositBtn) {
    depositBtn.addEventListener("click", () => {
      window.location.href = "deposit.html";
    });
  }

  // Withdraw button → withdraw.html သွားမယ်
  const withdrawBtn = document.getElementById("withdraw-btn");
  if (withdrawBtn) {
    withdrawBtn.addEventListener("click", () => {
      window.location.href = "withdraw.html";
    });
  }

  // ✅ Highlight Wallet Tab (bottom nav)
  const walletNav = document.querySelector(".bottombar a[href='wallet.html']");
  if (walletNav) {
    walletNav.classList.add("active-wallet");
  }
});
