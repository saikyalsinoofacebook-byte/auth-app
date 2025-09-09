const API = window.location.hostname === "localhost" ? "http://localhost:5000" : window.location.origin;

// DOM elements
let wheelCanvas, spinBtn, freeState, freeTimer, tokenCount, buyBtn, historyEl;
let modal, closeModal, resultTitle, resultDesc, claimForm, submitClaim, contactAdmin, okBtn;
let serverWrap, gameSel, gameId, serverId;

// State
let email = null;
let currentGiftId = null;
let countdownTimer = null;
let giftState = {
  freeSpin: false,
  tokens: 0,
  lastFreeTokenAt: null
};

// Wheel configuration
let ctx;
const labels = [
  "Good Luck",
  "Ks-10",
  "Ks-30",
  "Ks-100",
  "Ks-500",
  "Ks-1000",
  "Ks-3000",
  "Ks-10000",
  "Diamond 10,000",
  "UC 1000",
  "iPhone 16"
];

const labelIcons = [
  "bi-shield-check", // Good Luck
  "bi-coin", // Ks-10
  "bi-cash-coin", // Ks-30
  "bi-bank", // Ks-100
  "bi-wallet2", // Ks-500
  "bi-cash-stack", // Ks-1000
  "bi-gem", // Ks-3000
  "bi-diamond", // Ks-10000
  "bi-gem", // Diamond 10,000
  "bi-controller", // UC 1000
  "bi-phone"  // iPhone 16
];

const labelColors = [
  "#4CAF50", // Good Luck - Green
  "#FFC107", // Ks-10 - Amber
  "#FF9800", // Ks-30 - Orange
  "#FF5722", // Ks-100 - Deep Orange
  "#E91E63", // Ks-500 - Pink
  "#9C27B0", // Ks-1000 - Purple
  "#673AB7", // Ks-3000 - Deep Purple
  "#3F51B5", // Ks-10000 - Indigo
  "#2196F3", // Diamond 10,000 - Blue
  "#00BCD4", // UC 1000 - Cyan
  "#009688"  // iPhone 16 - Teal
];

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizePrize(prize) {
  return prize?.replace(/[^\w\s-]/g, '').trim() || '';
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Wheel drawing
function drawWheel(rotation = 0) {
  if (!ctx) {
    console.error("Canvas context not initialized!");
    return;
  }
  if (!wheelCanvas) {
    console.error("Wheel canvas not found!");
    return;
  }
  
  console.log("Drawing wheel with rotation:", rotation);
  const r = 260, cx = 260, cy = 260;
  ctx.clearRect(0, 0, 520, 520);
  const seg = (2 * Math.PI) / labels.length;

  for (let i = 0; i < labels.length; i++) {
    const a0 = rotation + i * seg, a1 = a0 + seg;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.fillStyle = i % 2 ? "#eff6ff" : "#dbeafe";
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a0 + seg / 2);
    
    // Draw icon symbol with color
    ctx.textAlign = "center";
    ctx.fillStyle = labelColors[i];
    ctx.font = "bold 18px Arial";
    ctx.fillText(getIconSymbol(labelIcons[i]), 0, -r + 30);
    
    // Draw label text with better visibility
    ctx.textAlign = "center";
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 12px Poppins";
    ctx.fillText(labels[i], 0, -r + 50);
    ctx.restore();
  }
  
  // Ring
  ctx.beginPath();
  ctx.arc(cx, cy, r - 6, 0, 2 * Math.PI);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 12;
  ctx.stroke();
  
  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, 2 * Math.PI);
  ctx.fillStyle = "#2563eb";
  ctx.fill();
  
  // Center text
  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GO", cx, cy + 7);
}

// Helper function to convert Bootstrap icon names to text symbols
function getIconSymbol(iconName) {
  const iconMap = {
    "bi-shield-check": "✓",
    "bi-coin": "₵",
    "bi-cash-coin": "₵",
    "bi-bank": "🏦",
    "bi-wallet2": "💳",
    "bi-cash-stack": "💰",
    "bi-gem": "💎",
    "bi-diamond": "💎",
    "bi-controller": "🎮",
    "bi-phone": "📱"
  };
  return iconMap[iconName] || "?";
}

// State management
async function refreshState() {
  await loadGiftState();
}

function setCountdown(freeNextAt) {
  if (countdownTimer) clearInterval(countdownTimer);
  if (!freeNextAt) {
    freeTimer.textContent = "";
    return;
  }
  
  const updateTimer = () => {
    const now = new Date();
    const target = new Date(freeNextAt);
    const diff = target - now;
    
    if (diff <= 0) {
      clearInterval(countdownTimer);
      freeTimer.textContent = "";
      refreshState();
      return;
    }
    
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    freeTimer.textContent = `• in ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };
  
  updateTimer();
  countdownTimer = setInterval(updateTimer, 1000);
}

async function loadHistory() {
  try {
    const r = await fetch(`${API}/api/gift/history/${email}`);
    const history = await safeJson(r) || [];
    
    historyEl.innerHTML = history.map(item => `
      <div class="history-item">
        <span class="prize">${item.remark || 'Unknown Prize'}</span>
        <span class="status ${item.status.toLowerCase()}">${item.status}</span>
      </div>
    `).join('');
  } catch {
    historyEl.innerHTML = '<div class="history-item">No history available</div>';
  }
}

// Modal functions
function openModal() {
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModalFn() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  claimForm.classList.add("hidden");
  contactAdmin.classList.add("hidden");
  resultDesc.textContent = "";
  currentGiftId = null;
}

// Load gift state from server
async function loadGiftState() {
  if (!email) return;
  
  try {
    console.log("Loading gift state for:", email);
    const res = await fetch(`${API}/api/gift/state/${email}`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    
    const data = await res.json();
    console.log("Gift state received:", data);
    
    giftState = {
      freeSpin: data.free_available || false,
      tokens: data.tokens || 0,
      lastFreeTokenAt: data.free_next_at ? new Date(data.free_next_at).getTime() - 24 * 60 * 60 * 1000 : null
    };
    
    updateUI();
    setCountdown(data.free_next_at);
  } catch (err) {
    console.error("Failed to load gift state:", err);
    // Set default state
    giftState = { freeSpin: false, tokens: 0, lastFreeTokenAt: null };
    updateUI();
  }
}

// Update UI based on current state
function updateUI() {
  if (tokenCount) {
    tokenCount.textContent = giftState.tokens;
  }
  
  if (freeState) {
    if (giftState.freeSpin) {
      freeState.textContent = "Available";
      freeState.style.color = "#4CAF50";
      if (freeTimer) {
        freeTimer.textContent = "";
      }
    } else {
      freeState.textContent = "Later";
      freeState.style.color = "#FF9800";
      // Timer will be updated by startCountdownTimer
    }
  }
}

// Set countdown timer based on next free spin time
function setCountdown(nextFreeTime) {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  
  if (!nextFreeTime) {
    // No next time, free spin available
    giftState.freeSpin = true;
    updateUI();
    return;
  }
  
  const nextTime = new Date(nextFreeTime);
  const now = new Date();
  
  if (now >= nextTime) {
    // Time's up, free spin available
    giftState.freeSpin = true;
    updateUI();
    return;
  }
  
  // Start countdown
  const updateCountdown = () => {
    const now = new Date();
    const timeLeft = nextTime - now;
    
    if (timeLeft <= 0) {
      // Time's up, free spin available
      giftState.freeSpin = true;
      updateUI();
      clearInterval(countdownTimer);
      return;
    }
    
    // Update countdown display
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (freeState) {
      freeState.textContent = timeString;
      freeState.style.color = "#FF9800";
    }
    
    if (freeTimer) {
      freeTimer.textContent = "";
    }
  };
  
  updateCountdown(); // Initial update
  countdownTimer = setInterval(updateCountdown, 1000); // Update every second
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Get user email
  const user = localStorage.getItem("user");
  if (user) {
    try {
      const userData = JSON.parse(user);
      email = userData.email;
    } catch {
      email = localStorage.getItem("email");
    }
  } else {
    email = localStorage.getItem("email");
  }
  
  if (!email) {
    alert("Please login first");
    window.location.href = "/login.html";
    return;
  }
  
  console.log("Current user email:", email);
  
  // Initialize DOM elements
  wheelCanvas = document.getElementById("wheelCanvas");
  spinBtn = document.getElementById("spinBtn");
  freeState = document.getElementById("freeState");
  freeTimer = document.getElementById("freeTimer");
  tokenCount = document.getElementById("tokenCount");
  buyBtn = document.getElementById("buyBtn");
  historyEl = document.getElementById("history");
  modal = document.getElementById("modal");
  closeModal = document.getElementById("closeModal");
  resultTitle = document.getElementById("resultTitle");
  resultDesc = document.getElementById("resultDesc");
  claimForm = document.getElementById("claimForm");
  submitClaim = document.getElementById("submitClaim");
  contactAdmin = document.getElementById("contactAdmin");
  okBtn = document.getElementById("okBtn");
  serverWrap = document.getElementById("serverWrap");
  gameSel = document.getElementById("game");
  gameId = document.getElementById("game_id");
  serverId = document.getElementById("server_id");

  // Initialize canvas context
  if (wheelCanvas) {
    ctx = wheelCanvas.getContext("2d");
    console.log("Canvas context initialized:", !!ctx);
    drawWheel(0);
  } else {
    console.error("wheelCanvas element not found!");
  }

  // Initialize button event handlers
  console.log("DOM elements initialized:", {
    spinBtn: !!spinBtn,
    buyBtn: !!buyBtn,
    wheelCanvas: !!wheelCanvas,
    tokenCount: !!tokenCount
  });

  if (spinBtn) {
    console.log("Setting up spin button event handler");
    spinBtn.onclick = async () => {
      console.log("Spin button clicked!");
      if (!email) return alert("Email required");
      
      const currentTokens = giftState.tokens || 0;
      const freeAvailable = giftState.freeSpin;
      
      console.log("Current tokens:", currentTokens);
      console.log("Free available:", freeAvailable);
      
      if (currentTokens <= 0 && !freeAvailable) {
        alert("No tokens available and no free spin. Please buy tokens first.");
        return;
      }
      
      spinBtn.disabled = true;
      try {
        console.log("Spinning wheel for email:", email);
        const res = await fetch(`${API}/api/gift/spin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail: email })
        });
        
        if (!res.ok) {
          throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }
        
        const data = await safeJson(res) || {};
        console.log("Server response:", data);
        
        if (data.error) {
          console.error("Server error:", data.error);
          alert(`Server Error: ${data.error}`);
          return;
        }
        
        if (!data.prize) {
          console.error("No prize in response:", data);
          alert("No prize received from server");
          return;
        }
        
        console.log("Prize received:", data.prize);
        console.log("Updated tokens:", data.tokens);
        
        // Update token count immediately
        if (data?.tokens !== undefined) {
          giftState.tokens = data.tokens;
          tokenCount.textContent = data.tokens;
          console.log("Token count updated to:", data.tokens);
        }
        
        // Refresh state to get updated free spin status
        await refreshState();
        
        // Find target rotation
        const targetPrize = data.prize;
        const targetIndex = labels.findIndex(label => normalizePrize(label) === normalizePrize(targetPrize));
        const targetRotation = targetIndex >= 0 ? (targetIndex * (2 * Math.PI / labels.length)) : 0;
        
        // Wheel animation
        let rot = 0;
        console.log("Starting wheel animation, target rotation:", targetRotation);
        
        const fullRotations = 3 + Math.random() * 2;
        const totalRotation = fullRotations * 2 * Math.PI + targetRotation;
        
        for (let i = 0; i < 30; i++) {
          const progress = i / 29;
          const easeOut = 1 - Math.pow(1 - progress, 2);
          
          rot = totalRotation * easeOut;
          drawWheel(rot);
          await sleep(100);
        }
        
        rot = targetRotation;
        console.log("Final rotation:", rot);
        drawWheel(rot);
        
        // Re-enable spin button
        spinBtn.disabled = false;

        currentGiftId = data.id || null;
        const prizeName = normalizePrize(data.prize || data.title);
        
        // Result UI
        if (prizeName === "iPhone 16") {
          resultTitle.textContent = "iPhone 16 Winner";
          resultDesc.textContent = "iPhone 16 ပေါက်ပြီးပါပြီ။ Admin ကို ဆက်သွယ်ပြီး ဆုရယူပါ။";
          contactAdmin.classList.remove("hidden");
          contactAdmin.onclick = async () => {
            try {
              const res = await fetch(`${API}/api/gift/contact-admin`);
              const j = await safeJson(res);
              if (j?.url) {
                location.href = j.url;
              } else {
                alert("Admin contact information not available");
              }
            } catch (err) {
              alert("Failed to get admin contact");
            }
          };
        } else if (prizeName.startsWith("Ks-")) {
          const amount = prizeName.replace("Ks-", "");
          resultTitle.textContent = `Congratulations! You won ${amount} Ks`;
          resultDesc.textContent = `${amount} Ks has been credited to your wallet.`;
        } else if (prizeName === "Diamond 10,000") {
          resultTitle.textContent = "Diamond 10,000 Winner";
          resultDesc.textContent = "Diamond 10,000 ပေါက်ပြီးပါပြီ။ Game ID နဲ့ Server ID ထည့်ပြီး claim လုပ်ပါ။";
          claimForm.classList.remove("hidden");
        } else if (prizeName === "UC 1000") {
          resultTitle.textContent = "UC 1000 Winner";
          resultDesc.textContent = "UC 1000 ပေါက်ပြီးပါပြီ။ Game ID နဲ့ Server ID ထည့်ပြီး claim လုပ်ပါ။";
          claimForm.classList.remove("hidden");
        } else {
          resultTitle.textContent = "Good Luck";
          resultDesc.textContent = "တခြားအကြိမ်ကောင်းပါစေ။";
        }

        openModal();
        
        // Refresh state and history
        await refreshState();
        await loadHistory();
      } catch (err) {
        console.error("Spin error:", err);
        alert(`Spin failed: ${err.message}`);
      } finally {
        spinBtn.disabled = false;
      }
    };
  }

  if (buyBtn) {
    console.log("Setting up buy button event handler");
    buyBtn.onclick = async () => {
      console.log("Buy button clicked!");
      try {
        const res = await fetch(`${API}/api/gift/buy-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail: email })
        });
        const data = await safeJson(res);
        if (data?.error) {
          if (data.redirect && data.message) {
            alert(data.message);
            window.location.href = data.redirect;
          } else {
            alert(data.error);
          }
          return;
        }
        
        // Update token count immediately
        if (data?.tokens !== undefined) {
          tokenCount.textContent = data.tokens;
          console.log("Buy token - Token count updated to:", data.tokens);
        }
        
        await refreshState();
      } catch (err) {
        alert("Failed to buy token");
      }
    };
  }

  // Modal event handlers
  if (closeModal) {
    closeModal.onclick = closeModalFn;
  }
  
  if (okBtn) {
    console.log("Setting up OK button event handler");
    okBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("OK button clicked");
      closeModalFn();
      loadHistory();
    };
  }
  
  if (gameSel) {
    gameSel.onchange = () => {
      if (gameSel.value === "pubg") serverWrap.classList.add("hidden");
      else serverWrap.classList.remove("hidden");
    };
  }
  
  if (submitClaim) {
    submitClaim.onclick = async () => {
      if (!currentGiftId) return;
      try {
        const res = await fetch(`${API}/api/gift/claim/${currentGiftId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: gameSel.value,
            game_id: gameId.value,
            server_id: serverId.value
          })
        });
        const data = await safeJson(res);
        if (data?.error) {
          alert(data.error);
          return;
        }
        alert("Claim submitted successfully!");
        closeModalFn();
        loadHistory();
      } catch (err) {
        alert("Failed to submit claim");
      }
    };
  }

  // Load initial state
  console.log("Loading initial state...");
  refreshState();
  loadHistory();
});

// Fallback initialization
if (document.readyState === 'loading') {
  console.log("DOM still loading, waiting for DOMContentLoaded");
} else {
  console.log("DOM already loaded, dispatching DOMContentLoaded event");
  document.dispatchEvent(new Event('DOMContentLoaded'));
}