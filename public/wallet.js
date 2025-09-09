// ======================
// Backend API base
// ======================
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : window.location.origin;

// ✅ LocalStorage ထဲက user info ယူ
const USER = JSON.parse(localStorage.getItem("user"));
const USER_ID = USER?.id || null;
const EMAIL = USER?.email || null;

// ✅ Debug user info
console.log("👤 User from localStorage:", USER);
console.log("🆔 User ID extracted:", USER_ID);
console.log("📧 Email extracted:", EMAIL);

// ======================
// Wallet Load
// ======================
async function loadWallet() {
  if (!USER_ID) {
    console.warn("⚠️ No user ID found in localStorage!");
    alert("⚠️ Please login first to view wallet");
    return;
  }

  try {
    console.log(`🔄 Loading wallet for user ID: ${USER_ID}`);
    console.log(`🌐 API URL: ${API_BASE}/api/wallet/${USER_ID}`);
    
    // Show loading for wallet balance
    const totalBalanceElement = document.getElementById("total-balance");
    const availableElement = document.getElementById("available");
    const onholdElement = document.getElementById("onhold");
    
    if (totalBalanceElement) {
      window.loadingAnimation.showInlineLoading(totalBalanceElement, "Loading...");
    }
    
    const res = await fetch(`${API_BASE}/api/wallet/${USER_ID}`);
    console.log(`📡 Response status: ${res.status}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ API Error: ${res.status} - ${errorText}`);
      throw new Error(`Server error: ${res.status}`);
    }

    const wallet = await res.json();
    console.log("✅ Wallet data received:", wallet);

    if (totalBalanceElement) {
      totalBalanceElement.textContent = Number(wallet.balance ?? 0).toFixed(2);
    }
    if (availableElement) {
      availableElement.textContent = Number(wallet.available_balance ?? 0).toFixed(2);
    }
    if (onholdElement) {
      onholdElement.textContent = Number(wallet.on_hold_balance ?? 0).toFixed(2);
    }
  } catch (err) {
    console.error("❌ Wallet load error:", err);
    alert("❌ Wallet load error: " + err.message);
  }
}

// ======================
// Transactions Load
// ======================
async function loadTransactions() {
  if (!USER_ID) {
    console.warn("⚠️ No user ID found for transactions!");
    return;
  }

  try {
    console.log(`🔄 Loading transactions for user ID: ${USER_ID}`);
    console.log(`🌐 API URL: ${API_BASE}/api/transactions/${USER_ID}`);
    
    const res = await fetch(`${API_BASE}/api/transactions/${USER_ID}`);
    console.log(`📡 Response status: ${res.status}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ API Error: ${res.status} - ${errorText}`);
      throw new Error(`Server error: ${res.status}`);
    }

    const data = await res.json();
    const txns = Array.isArray(data) ? data : (data.transactions || []);
    console.log("✅ Transactions data received:", txns);
    
    const txnList = document.getElementById("transactions-list");
    txnList.innerHTML = "";

    if (!txns || txns.length === 0) {
      txnList.innerHTML = "<p class='no-txn'>စာရင်းမရှိသေးပါ</p>";
      return;
    }

    // Sort transactions by created_at DESC to ensure most recent first
    const sortedTxns = txns.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA; // Most recent first
    });

    sortedTxns.forEach((txn, index) => {
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

      // Format date for better display
      let formattedDate = "";
      if (txn.created_at) {
        const date = new Date(txn.created_at);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) {
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          formattedDate = `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
          formattedDate = `${diffHours}h ago`;
        } else if (diffDays < 7) {
          formattedDate = `${diffDays}d ago`;
        } else {
          formattedDate = date.toLocaleDateString();
        }
      }

      // Handle special prizes display
      let amountDisplay = "";
      if (txn.type === "gift" && txn.amount === 0 && txn.remark) {
        // Special prizes (Diamond 10,000, UC 1000, iPhone 16, etc.)
        amountDisplay = txn.remark;
      } else {
        // Regular transactions with amounts
        amountDisplay = `${txn.amount > 0 ? "+" : ""}${Number(txn.amount).toFixed(2)}`;
      }

      const card = document.createElement("div");
      card.className = "txn-card";
      card.innerHTML = `
        <div class="txn-left">
          <i class="bi bi-wallet2 icon"></i>
          <div>
            <strong>${txn.type || "Transaction"}</strong><br>
            <small>${formattedDate}</small><br>
            <span class="${statusClass}">${statusText}</span>
          </div>
        </div>
        <div class="txn-right ${amountClass}">
          ${amountDisplay}
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
  if (!USER_ID) return;

  try {
    const res = await fetch(`${API_BASE}/api/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER_ID, amount }),
    });

    const data = await res.json();
    if (res.ok) {
      alert("✅ Deposit successful");

      // ✅ Update wallet from response
      document.getElementById("total-balance").textContent =
        Number(data.wallet.balance).toFixed(2);
      document.getElementById("available").textContent =
        Number(data.wallet.available_balance).toFixed(2);
      document.getElementById("onhold").textContent =
        Number(data.wallet.on_hold_balance).toFixed(2);

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
  if (!USER_ID) return;

  try {
    const res = await fetch(`${API_BASE}/api/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER_ID, amount }),
    });

    const data = await res.json();
    if (res.ok) {
      alert("✅ Withdraw successful");

      // ✅ Update wallet from response
      document.getElementById("total-balance").textContent =
        Number(data.wallet.balance).toFixed(2);
      document.getElementById("available").textContent =
        Number(data.wallet.available_balance).toFixed(2);
      document.getElementById("onhold").textContent =
        Number(data.wallet.on_hold_balance).toFixed(2);

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
  if (!USER_ID) {
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
