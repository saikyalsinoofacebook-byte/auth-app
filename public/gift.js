const API = "https://arthur-game-shop.onrender.com";

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
// Show big prizes on wheel for all users (but normal users can't actually win them)
const labels = [
  "iPhone 16",        // Big prize - only special users can win
  "Diamond 10,000",   // Big prize - only special users can win  
  "Ks-10000",         // Big prize - only special users can win
  "Ks-5000",          // Big prize - only special users can win
  "Ks-3000",          // Big prize - only special users can win
  "Ks-1000",          // Big prize - only special users can win
  "Ks-100",           // Small prize - normal users can win
  "Ks-50",            // Small prize - normal users can win
  "Ks-30",            // Small prize - normal users can win
  "Ks-10",            // Small prize - normal users can win
  "Good Luck",        // Small prize - normal users can win
  "Try Again"         // Small prize - normal users can win
];

const labelIcons = [
  "bi-phone", // iPhone 16
  "bi-gem", // Diamond 10,000
  "bi-diamond", // Ks-10000
  "bi-cash-stack", // Ks-5000
  "bi-gem", // Ks-3000
  "bi-wallet2", // Ks-1000
  "bi-bank", // Ks-100
  "bi-cash-coin", // Ks-50
  "bi-coin", // Ks-30
  "bi-coin", // Ks-10
  "bi-shield-check", // Good Luck
  "bi-arrow-clockwise" // Try Again
];

const labelColors = [
  "#FF1744", // iPhone 16 - Bright Red (Big Prize)
  "#00E676", // Diamond 10,000 - Bright Green (Big Prize)
  "#2196F3", // Ks-10000 - Bright Blue (Big Prize)
  "#FF9800", // Ks-5000 - Bright Orange (Big Prize)
  "#9C27B0", // Ks-3000 - Purple (Big Prize)
  "#E91E63", // Ks-1000 - Pink (Big Prize)
  "#FF5722", // Ks-100 - Deep Orange (Small Prize)
  "#FF9800", // Ks-50 - Orange (Small Prize)
  "#FFC107", // Ks-30 - Amber (Small Prize)
  "#FFC107", // Ks-10 - Amber (Small Prize)
  "#4CAF50", // Good Luck - Green (Small Prize)
  "#9E9E9E"  // Try Again - Grey (Small Prize)
];

// Special user emails (same as server)
const SPECIAL_WIN_EMAILS = [
  "adminadmin@admin",
  "vipuser@gmail.com", 
  "special@mail.com",
  "aimaim@gmail.com",
  "emily12@gmail.com",
  "vito@gmail.com"
];

// Check if current user is special
function isSpecialUser() {
  return SPECIAL_WIN_EMAILS.includes(email?.toLowerCase());
}

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
  
  console.log("Drawing wheel with", labels.length, "segments");
  console.log("Labels:", labels);
  
  // Force canvas size
  wheelCanvas.width = 520;
  wheelCanvas.height = 520;
  
  const r = 250, cx = 260, cy = 260;
  ctx.clearRect(0, 0, 520, 520);
  const seg = (2 * Math.PI) / 12; // Force 12 segments

  // Draw all 12 segments
  for (let i = 0; i < 12; i++) {
    const a0 = rotation + i * seg, a1 = a0 + seg;
    const label = labels[i] || `Segment ${i}`;
    console.log(`Segment ${i}: ${label} (angle: ${(a0 * 180 / Math.PI).toFixed(1)}° to ${(a1 * 180 / Math.PI).toFixed(1)}°)`);
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    
    // Different colors for big prizes vs small prizes
    if (i < 6) {
      // Big prizes - brighter colors
      ctx.fillStyle = i % 2 ? "#e3f2fd" : "#bbdefb";
    } else {
      // Small prizes - normal colors
      ctx.fillStyle = i % 2 ? "#eff6ff" : "#dbeafe";
    }
    ctx.fill();

    // Draw segment border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a0 + seg / 2);
    
    // Draw icon symbol with color (bigger and centered)
    ctx.textAlign = "center";
    ctx.fillStyle = labelColors[i] || "#000000";
    ctx.font = "bold 32px Arial"; // Much bigger icon
    ctx.fillText(getIconSymbol(labelIcons[i] || "?"), 0, -r + 50);
    
    ctx.restore();
  }
  
  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, 2 * Math.PI);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.stroke();
  
  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, 2 * Math.PI);
  ctx.fillStyle = "#2563eb";
  ctx.fill();
  
  // Center text
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText("အခုလှည့်နိုင်ပြီနိုပ်ပီ", cx, cy + 6);
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
    "bi-phone": "📱",
    "bi-arrow-clockwise": "↻"
  };
  return iconMap[iconName] || "?";
}

// State management
async function refreshState() {
  await loadGiftState();
  // Redraw wheel to ensure all segments are visible
  if (ctx && wheelCanvas) {
    drawWheel(0);
  }
}


// Ensure canvas is properly initialized
function ensureCanvasReady() {
  if (wheelCanvas && ctx) {
    console.log("Canvas ready - size:", wheelCanvas.width, "x", wheelCanvas.height);
    console.log("Context ready:", !!ctx);
    return true;
  }
  return false;
}

// Manual segment creation to ensure all 12 are visible
function createAllSegments() {
  if (!ctx || !wheelCanvas) return;
  
  console.log("MANUAL SEGMENT CREATION - Creating all 12 segments");
  console.log("Canvas size:", wheelCanvas.width, "x", wheelCanvas.height);
  
  // Force canvas size
  wheelCanvas.width = 520;
  wheelCanvas.height = 520;
  
  const r = 250, cx = 260, cy = 260;
  ctx.clearRect(0, 0, 520, 520);
  const seg = (2 * Math.PI) / 12; // Force 12 segments
  
  console.log("Segment angle:", (seg * 180 / Math.PI).toFixed(1), "degrees per segment");
  
  for (let i = 0; i < 12; i++) {
    const a0 = i * seg, a1 = a0 + seg;
    const label = labels[i] || `Segment ${i}`;
    console.log(`Creating Segment ${i}: ${label} (angle: ${(a0 * 180 / Math.PI).toFixed(1)}° to ${(a1 * 180 / Math.PI).toFixed(1)}°)`);
    
    // Draw segment background
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    
    // Different colors for big prizes vs small prizes
    if (i < 6) {
      // Big prizes - brighter colors
      ctx.fillStyle = i % 2 ? "#e3f2fd" : "#bbdefb";
    } else {
      // Small prizes - normal colors
      ctx.fillStyle = i % 2 ? "#eff6ff" : "#dbeafe";
    }
    ctx.fill();

    // Draw segment border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw text and icon
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a0 + seg / 2);
    
    // Draw icon symbol with color (bigger and centered)
    ctx.textAlign = "center";
    ctx.fillStyle = labelColors[i] || "#000000";
    ctx.font = "bold 32px Arial"; // Much bigger icon
    ctx.fillText(getIconSymbol(labelIcons[i] || "?"), 0, -r + 50);
    
    ctx.restore();
  }
  
  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, 2 * Math.PI);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.stroke();
  
  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, 2 * Math.PI);
  ctx.fillStyle = "#2563eb";
  ctx.fill();
  
  // Center text
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText("အခုလှည့်နိုင်ပြီနိုပ်ပီ", cx, cy + 6);
  
  console.log("Wheel creation completed with 12 segments");
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
    
    // Show loading for gift state
    const freeSpinLabel = document.getElementById('freeSpinLabel');
    if (freeSpinLabel) {
      window.loadingAnimation.showInlineLoading(freeSpinLabel, "Loading...");
    }
    
    const res = await fetch(`${API}/api/gift/state/${email}`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    
    const data = await res.json();
    console.log("Gift state received:", data);
    
    giftState = {
      freeSpin: data.freeSpin || false,
      tokens: data.tokens || 0,
      remaining_time: data.remaining_time || 0
    };
    
    console.log("Gift state updated:", giftState);
    
    updateUI();
    
    // Start countdown timer if free spin is not available
    if (!giftState.freeSpin && giftState.remaining_time > 0) {
      startCountdownTimer();
    }
  } catch (err) {
    console.error("Failed to load gift state:", err);
    const freeSpinLabel = document.getElementById('freeSpinLabel');
    if (freeSpinLabel) {
      freeSpinLabel.textContent = "Error";
    }
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
  
  // Update free spin label with countdown
  const freeSpinLabel = document.getElementById('freeSpinLabel');
  console.log("Looking for freeSpinLabel element:", freeSpinLabel);
  
  if (freeSpinLabel) {
    if (giftState.freeSpin) {
      // Show Spin button active
      freeSpinLabel.textContent = "Free Spin";
      freeSpinLabel.style.color = "#4CAF50";
      console.log("Updated freeSpinLabel to: Free Spin");
    } else {
      // Show remaining time countdown
      let seconds = giftState.remaining_time;
      let hours = Math.floor(seconds / 3600);
      let minutes = Math.floor((seconds % 3600) / 60);
      freeSpinLabel.textContent = `Later ${hours}h ${minutes}m`;
      freeSpinLabel.style.color = "#FF9800";
      console.log(`Updated freeSpinLabel to: Later ${hours}h ${minutes}m`);
    }
  } else {
    // Fallback: try to find other elements that might show free spin status
    const freeState = document.getElementById('freeState') || document.querySelector('.free-state');
    console.log("Looking for freeState element:", freeState);
    
    if (freeState) {
      if (giftState.freeSpin) {
        freeState.textContent = "Free Spin Available";
        freeState.style.color = "#4CAF50";
        console.log("Updated freeState to: Free Spin Available");
      } else {
        let seconds = giftState.remaining_time;
        let hours = Math.floor(seconds / 3600);
        let minutes = Math.floor((seconds % 3600) / 60);
        freeState.textContent = `Later ${hours}h ${minutes}m`;
        freeState.style.color = "#FF9800";
        console.log(`Updated freeState to: Later ${hours}h ${minutes}m`);
      }
    } else {
      console.log("No free spin display elements found");
    }
  }

  // Update spin button state
  if (spinBtn) {
    const currentTokens = giftState.tokens || 0;
    const freeAvailable = giftState.freeSpin;
    const canSpin = currentTokens > 0 || freeAvailable;
    
    if (!canSpin) {
      spinBtn.disabled = true;
      spinBtn.textContent = "Token မရှိပါ";
      spinBtn.style.backgroundColor = "#ccc";
      spinBtn.style.cursor = "not-allowed";
    } else if (freeAvailable && currentTokens > 0) {
      spinBtn.disabled = false;
      spinBtn.textContent = "အခုလှည့်နိုင်ပြီနိုပ်ပီ (Free)";
      spinBtn.style.backgroundColor = "#4CAF50";
      spinBtn.style.cursor = "pointer";
    } else if (freeAvailable) {
      spinBtn.disabled = false;
      spinBtn.textContent = "Free Spin";
      spinBtn.style.backgroundColor = "#4CAF50";
      spinBtn.style.cursor = "pointer";
    } else {
      spinBtn.disabled = false;
      spinBtn.textContent = "အခုလှည့်နိုင်ပြီနိုပ်ပီ";
      spinBtn.style.backgroundColor = "";
      spinBtn.style.cursor = "pointer";
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
    
    const timeString = `Next free spin in: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (freeState) {
      freeState.textContent = "Not Available";
      freeState.style.color = "#FF9800";
    }
    
    if (freeTimer) {
      freeTimer.textContent = timeString;
    }
  };
  
  updateCountdown(); // Initial update
  countdownTimer = setInterval(updateCountdown, 1000); // Update every second
}

// Start countdown timer for remaining time
function startCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  
  const updateCountdown = async () => {
    if (giftState.remaining_time <= 0) {
      // Time's up, claim free token from server
      try {
        const res = await fetch(`${API}/api/gift/claim-free-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail: email })
        });
        
        if (res.ok) {
          const data = await res.json();
          giftState.freeSpin = true;
          giftState.remaining_time = 0;
          giftState.tokens = (giftState.tokens || 0) + 1; // Add 1 free token
          updateUI();
          clearInterval(countdownTimer);
          
          // Notify user about free token
          console.log("🎉 24-hour countdown complete! You received 1 free token!");
          alert("🎉 Congratulations! You received 1 free token!");
        } else {
          console.error("Failed to claim free token");
        }
      } catch (err) {
        console.error("Error claiming free token:", err);
      }
      return;
    }
    
    // Decrease remaining time by 1 second
    giftState.remaining_time--;
    updateUI();
  };
  
  // Initial update
  updateCountdown();
  
  // Update every second
  countdownTimer = setInterval(updateCountdown, 1000);
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
    
    // Ensure canvas has correct size
    wheelCanvas.width = 520;
    wheelCanvas.height = 520;
    
    console.log("Canvas initialized - size:", wheelCanvas.width, "x", wheelCanvas.height);
    console.log("Context created:", !!ctx);
    
    // Draw wheel immediately using manual creation
    if (ensureCanvasReady()) {
      createAllSegments();
    }
    
    // Force redraw after a short delay to ensure everything is loaded
    setTimeout(() => {
      if (ensureCanvasReady()) {
        createAllSegments();
      }
    }, 500);
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
  
  // Redraw wheel on window resize
  window.addEventListener('resize', () => {
    if (ctx && wheelCanvas) {
      drawWheel(0);
    }
  });
  
  // Force redraw when page is fully loaded
  window.addEventListener('load', () => {
    if (ctx && wheelCanvas) {
      console.log("Page loaded - forcing wheel redraw");
      drawWheel(0);
    }
  });
  
  // Additional redraw attempts
  setTimeout(() => {
    if (ctx && wheelCanvas) {
      console.log("Delayed redraw attempt 1");
      createAllSegments();
    }
  }, 1000);
  
  setTimeout(() => {
    if (ctx && wheelCanvas) {
      console.log("Delayed redraw attempt 2");
      createAllSegments();
    }
  }, 2000);
  
  setTimeout(() => {
    if (ctx && wheelCanvas) {
      console.log("Final redraw attempt");
      createAllSegments();
    }
  }, 3000);

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
        alert("Token မရှိပါ နှင့် free spin မရှိပါ။ ကျေးဇူးပြု၍ token များကို ဝယ်ယူပါ သို့မဟုတ် မနက်ဖန် free spin ကို စောင့်ပါ။");
        return;
      }
      
      // Show loading state
      window.loadingAnimation.setButtonLoading(spinBtn, "Spinning...");
      
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
        
        // Result UI - Different display for special vs normal users
        const isSpecial = isSpecialUser();
        
        if (prizeName === "iPhone 16" && isSpecial) {
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
          if (isSpecial) {
            resultTitle.textContent = `Congratulations! You won ${amount} Ks`;
            resultDesc.textContent = `${amount} Ks has been credited to your wallet.`;
          } else {
            resultTitle.textContent = `You won ${amount} Ks!`;
            resultDesc.textContent = `Congratulations! ${amount} Ks has been added to your wallet.`;
          }
        } else if (prizeName === "Diamond 10,000" && isSpecial) {
          resultTitle.textContent = "Diamond 10,000 Winner";
          resultDesc.textContent = "Diamond 10,000 ပေါက်ပြီးပါပြီ။ Game ID နဲ့ Server ID ထည့်ပြီး claim လုပ်ပါ။";
          claimForm.classList.remove("hidden");
        } else if (prizeName === "Good Luck") {
          resultTitle.textContent = "Good Luck!";
          resultDesc.textContent = "တခြားအကြိမ်ကောင်းပါစေ။ Keep trying!";
        } else if (prizeName === "Try Again") {
          resultTitle.textContent = "Try Again!";
          resultDesc.textContent = "အကြိမ်တစ်ခုထပ်ကြိုးစားကြည့်ပါ။";
        } else if (prizeName === "Better Luck Next Time") {
          resultTitle.textContent = "Better Luck Next Time!";
          resultDesc.textContent = "နောက်တစ်ကြိမ်ပိုကောင်းပါစေ။";
        } else {
          resultTitle.textContent = "Good Luck!";
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
        // Re-enable spin button
        window.loadingAnimation.removeButtonLoading(spinBtn);
      }
    };
  }

  if (buyBtn) {
    console.log("Setting up buy button event handler");
    buyBtn.onclick = async () => {
      console.log("Buy button clicked!");
      
      // Show loading state
      window.loadingAnimation.setButtonLoading(buyBtn, "Processing...");
      
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
      } finally {
        // Re-enable buy button
        window.loadingAnimation.removeButtonLoading(buyBtn);
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