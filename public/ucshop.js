// ======================
// Backend API base
// ======================
const API = "https://arthur-game-shop.onrender.com";

// ======================
// State Management
// ======================
let selectedItem = null;
let selectedMethod = "wallet";
let user = null;

// ======================
// DOM Elements
// ======================
const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const cancelBtn = document.getElementById("cancelBtn");
const confirmBtn = document.getElementById("confirmBtn");
const paymentSection = document.getElementById("payment-extra");

// ======================
// Initialize
// ======================
document.addEventListener("DOMContentLoaded", () => {
  // Get user info
  const userData = localStorage.getItem("user");
  if (userData) {
    user = JSON.parse(userData);
  }

  // Load wallet balance
  loadWalletBalance();

  // ===== Item Cards Click =====
  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      if (card.classList.contains("coming-soon")) {
        alert("Coming Soon!");
        return;
      }
      
      selectedItem = {
        name: card.dataset.name,
        price: parseInt(card.dataset.price),
        img: card.dataset.img
      };
      
      showModal();
    });
  });

  // ===== Modal Controls =====
  closeModal.addEventListener("click", () => modal.classList.remove("show"));
  cancelBtn.addEventListener("click", () => modal.classList.remove("show"));

  // ===== Payment Method Select =====
  document.querySelectorAll(".method").forEach(btn => {
    btn.addEventListener("click", () => {
      // Remove selected class from all methods
      document.querySelectorAll(".method").forEach(method => {
        method.classList.remove("selected");
      });
      
      // Add selected class to clicked method
      btn.classList.add("selected");
      selectedMethod = btn.dataset.method;
      handlePaymentSelection(selectedMethod);
    });
  });

  function handlePaymentSelection(method) {
    if (method === "wallet") {
      paymentSection.innerHTML = `
        <p><strong>💳 Wallet ဖြင့် အဆက်မပြတ် ငွေပေးချေမည်</strong></p>
        <p>လက်ကျန်ငွေ: <span id="wallet-balance-modal">0</span> ကျပ်</p>
      `;
      // Update wallet balance in modal
      const walletBalanceModal = document.getElementById("wallet-balance-modal");
      if (walletBalanceModal) {
        walletBalanceModal.textContent = document.getElementById("wallet-balance").textContent;
      }
    } else if (method === "kpay") {
      paymentSection.innerHTML = `
        <p><strong>📱 KPay ဖြင့် ပေးချေမည်</strong></p>
        <p>KPay Number: <strong>09-123456789</strong> <button onclick="copyNumber('09-123456789')">Copy</button></p>
        <p>Your Name: <input type="text" id="payerName" placeholder="Enter your name"></p>
        <p>Your Phone: <input type="text" id="payerPhone" placeholder="Enter your phone number"></p>
        <p>Payment Screenshot: <input type="file" id="screenshot" accept="image/*"></p>
      `;
    } else if (method === "wavepay") {
      paymentSection.innerHTML = `
        <p><strong>📱 WavePay ဖြင့် ပေးချေမည်</strong></p>
        <p>WavePay Number: <strong>09-987654321</strong> <button onclick="copyNumber('09-987654321')">Copy</button></p>
        <p>Your Name: <input type="text" id="payerName" placeholder="Enter your name"></p>
        <p>Your Phone: <input type="text" id="payerPhone" placeholder="Enter your phone number"></p>
        <p>Payment Screenshot: <input type="file" id="screenshot" accept="image/*"></p>
      `;
    }
  }

  // ===== Copy Number Function =====
  window.copyNumber = function (number) {
    navigator.clipboard.writeText(number);
    alert("Copied: " + number);
  };

  // ===== Confirm Order =====
  confirmBtn.addEventListener("click", () => {
    if (!selectedItem || !selectedMethod) {
      alert("❌ Item နဲ့ Payment Method ကိုရွေးပါ");
      return;
    }

    // Validate required fields
    const gameId = document.getElementById("gameId")?.value?.trim();
    
    if (!gameId) {
      alert("❌ Game ID ကိုထည့်ပါ");
      return;
    }

    // For non-wallet payments, check additional fields
    if (selectedMethod !== "wallet") {
      const payerName = document.getElementById("payerName")?.value?.trim();
      const payerPhone = document.getElementById("payerPhone")?.value?.trim();
      const screenshot = document.getElementById("screenshot")?.files[0];
      
      if (!payerName) {
        alert("❌ Your Name ကိုထည့်ပါ");
        return;
      }
      
      if (!payerPhone) {
        alert("❌ Your Phone Number ကိုထည့်ပါ");
        return;
      }
      
      if (!screenshot) {
        alert("❌ Payment Screenshot ကိုထည့်ပါ");
        return;
      }
    }

    const orderData = {
      item: selectedItem.name,
      price: selectedItem.price,
      method: selectedMethod,
      email: user?.email || "",
      gameId: gameId,
      gameName: "UC",
      payerName: document.getElementById("payerName")?.value || "",
      payerPhone: document.getElementById("payerPhone")?.value || "",
      screenshot: document.getElementById("screenshot")?.files[0]?.name || ""
    };

    console.log("✅ Order Data:", orderData);

    // Show loading state
    confirmBtn.textContent = "Processing...";
    confirmBtn.disabled = true;

    // Create FormData for file upload if needed
    let requestBody;
    let headers = { "Content-Type": "application/json" };

    if (selectedMethod !== "wallet" && document.getElementById("screenshot")?.files[0]) {
      const formData = new FormData();
      formData.append("email", orderData.email);
      formData.append("item", orderData.item);
      formData.append("price", orderData.price);
      formData.append("method", orderData.method);
      formData.append("gameId", orderData.gameId);
      formData.append("gameName", orderData.gameName);
      formData.append("payerName", orderData.payerName);
      formData.append("payerPhone", orderData.payerPhone);
      formData.append("screenshot", document.getElementById("screenshot").files[0]);
      
      requestBody = formData;
      headers = {}; // Let browser set Content-Type for FormData
    } else {
      requestBody = JSON.stringify(orderData);
    }

    fetch(`${API}/api/orders`, {
      method: "POST",
      headers: headers,
      body: requestBody,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Order failed");
          return;
        }
        alert("✔ Order confirmed! Order ID: " + data.order.order_id);
        modal.classList.remove("show");
        window.location.href = "orders.html";
      })
      .catch(err => {
        console.error("Order Error:", err);
        alert("❌ Order failed. Please try again.");
      })
      .finally(() => {
        // Reset button state
        confirmBtn.textContent = "Confirm";
        confirmBtn.disabled = false;
      });
  });

  // ===== Keyboard Support =====
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      modal.classList.remove("show");
    }
  });

  // ===== Touch Feedback =====
  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("touchstart", function() {
      this.style.transform = "scale(0.95)";
    });
    
    card.addEventListener("touchend", function() {
      this.style.transform = "scale(1)";
    });
  });

  // ===== Animation on Load =====
  const cards = document.querySelectorAll(".card");
  cards.forEach((card, index) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";
    
    setTimeout(() => {
      card.style.transition = "all 0.5s ease";
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
    }, index * 100);
  });
});

// ======================
// Functions
// ======================
async function loadWalletBalance() {
  if (!user?.email) return;
  
  try {
    const res = await fetch(`${API}/api/wallet/${user.id}`);
    if (!res.ok) throw new Error("Failed to fetch wallet");
    
    const wallet = await res.json();
    document.getElementById("wallet-balance").textContent = Number(wallet.balance ?? 0).toFixed(0);
  } catch (err) {
    console.error("Wallet load error:", err);
    document.getElementById("wallet-balance").textContent = "0";
  }
}

function showModal() {
  if (!selectedItem) return;
  
  // Update modal content
  document.getElementById("modal-img").src = selectedItem.img;
  document.getElementById("modal-img").alt = selectedItem.name;
  document.getElementById("modal-name").textContent = selectedItem.name;
  document.getElementById("modal-price").textContent = selectedItem.price.toLocaleString();
  document.getElementById("modal-balance").textContent = document.getElementById("wallet-balance").textContent;
  
  // Reset payment method
  selectedMethod = "wallet";
  document.querySelectorAll(".method").forEach(method => {
    method.classList.remove("selected");
  });
  document.querySelector('[data-method="wallet"]').classList.add("selected");
  
  // Show default payment info
  paymentSection.innerHTML = `
    <p><strong>💳 Wallet ဖြင့် အဆက်မပြတ် ငွေပေးချေမည်</strong></p>
    <p>လက်ကျန်ငွေ: <span id="wallet-balance-modal">${document.getElementById("wallet-balance").textContent}</span> ကျပ်</p>
  `;
  
  // Show modal
  modal.classList.add("show");
}
