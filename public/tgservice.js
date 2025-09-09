// Telegram Services JavaScript - Based on HOK Shop

const API = "https://arthur-game-shop.onrender.com";

// DOM elements
let grid, modal, closeModal, modalImg, modalName, modalPrice, modalBalance;
let telegramUsername, paymentMethods, paymentExtra, cancelBtn, confirmBtn;
let selectedMethod = null;
let currentItem = null;

// State
let email = null;
let userId = null;
let walletBalance = 0;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Telegram Services page loaded');
  initializeElements();
  setupEventListeners();
  loadUserData().then(() => {
    loadWalletBalance();
  });
});

function initializeElements() {
  // Grid and cards
  grid = document.getElementById('grid');
  
  // Modal elements
  modal = document.getElementById('modal');
  closeModal = document.getElementById('closeModal');
  modalImg = document.getElementById('modal-img');
  modalName = document.getElementById('modal-name');
  modalPrice = document.getElementById('modal-price');
  modalBalance = document.getElementById('modal-balance');
  
  // Form elements
  telegramUsername = document.getElementById('telegramUsername');
  paymentMethods = document.querySelectorAll('.method');
  paymentExtra = document.getElementById('payment-extra');
  cancelBtn = document.getElementById('cancelBtn');
  confirmBtn = document.getElementById('confirmBtn');
  
  console.log('Elements initialized:', {
    grid: !!grid,
    modal: !!modal,
    telegramUsername: !!telegramUsername,
    paymentMethods: paymentMethods.length
  });
}

function setupEventListeners() {
  // Card click handlers
  if (grid) {
    grid.addEventListener('click', handleCardClick);
  }
  
  // Modal handlers
  if (closeModal) {
    closeModal.addEventListener('click', closeModalHandler);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModalHandler);
  }
  
  if (confirmBtn) {
    confirmBtn.addEventListener('click', handleConfirmPurchase);
  }
  
  // Payment method selection
  paymentMethods.forEach(method => {
    method.addEventListener('click', () => selectPaymentMethod(method));
  });
  
  // Modal backdrop click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModalHandler();
      }
    });
  }
  
  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModalHandler();
    }
  });
}

function handleCardClick(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  
  const name = card.dataset.name;
  const price = parseInt(card.dataset.price);
  const img = card.dataset.img;
  
  if (!name || !price || !img) {
    console.error('Card data missing:', { name, price, img });
    return;
  }
  
  currentItem = { name, price, img };
  showModal(name, price, img);
}

function showModal(name, price, img) {
  if (!modal || !modalImg || !modalName || !modalPrice || !modalBalance) {
    console.error('Modal elements not found');
    return;
  }
  
  modalImg.src = img;
  modalImg.alt = name;
  modalName.textContent = name;
  modalPrice.textContent = price.toLocaleString();
  modalBalance.textContent = walletBalance.toLocaleString();
  
  // Reset form
  if (telegramUsername) {
    telegramUsername.value = '';
  }
  
  selectedMethod = null;
  paymentMethods.forEach(method => method.classList.remove('selected'));
  paymentExtra.innerHTML = '';
  
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  // Focus on username input
  if (telegramUsername) {
    setTimeout(() => telegramUsername.focus(), 100);
  }
}

function closeModalHandler() {
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
  currentItem = null;
  selectedMethod = null;
}

function selectPaymentMethod(method) {
  // Remove previous selection
  paymentMethods.forEach(m => m.classList.remove('selected'));
  
  // Add selection to clicked method
  method.classList.add('selected');
  selectedMethod = method.dataset.method;
  
  // Show additional payment info
  showPaymentExtra(selectedMethod);
}

function showPaymentExtra(method) {
  if (!paymentExtra) return;
  
  let extraHTML = '';
  
  switch (method) {
    case 'wallet':
      if (walletBalance < currentItem.price) {
        extraHTML = `
          <div class="payment-warning">
            <i class="bi bi-exclamation-triangle"></i>
            <p>လက်ကျန်ငွေ မလုံလောက်ပါ။ ငွေဖြည့်ပါ။</p>
          </div>
        `;
      }
      break;
      
    case 'kpay':
      extraHTML = `
        <div class="payment-info">
          <i class="bi bi-info-circle"></i>
          <p>KPay ဖြင့် ပေးချေပြီးနောက် Screenshot ပို့ပါ။</p>
        </div>
      `;
      break;
      
    case 'wavepay':
      extraHTML = `
        <div class="payment-info">
          <i class="bi bi-info-circle"></i>
          <p>WavePay ဖြင့် ပေးချေပြီးနောက် Screenshot ပို့ပါ။</p>
        </div>
      `;
      break;
  }
  
  paymentExtra.innerHTML = extraHTML;
}

function handleConfirmPurchase() {
  if (!currentItem) {
    alert('Please select an item first');
    return;
  }
  
  if (!selectedMethod) {
    alert('Please select a payment method');
    return;
  }
  
  // Validate Telegram username
  const username = telegramUsername.value.trim();
  if (!username) {
    alert('Please enter your Telegram username');
    telegramUsername.focus();
    return;
  }
  
  // Validate username format (should start with @)
  if (!username.startsWith('@')) {
    alert('Telegram username should start with @');
    telegramUsername.focus();
    return;
  }
  
  // Validate wallet balance for wallet payment
  if (selectedMethod === 'wallet' && walletBalance < currentItem.price) {
    alert('Insufficient wallet balance');
    return;
  }
  
  // Show loading state
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Processing...';
  
  // Create order data
  const orderData = {
    itemName: currentItem.name,
    price: currentItem.price,
    paymentMethod: selectedMethod,
    telegramUsername: username,
    userEmail: email
  };
  
  // Submit order
  submitOrder(orderData);
}

async function submitOrder(orderData) {
  try {
    console.log('Submitting order:', orderData);
    
    const formData = new FormData();
    formData.append("item", orderData.itemName);
    formData.append("price", orderData.price);
    formData.append("method", orderData.paymentMethod);
    formData.append("telegramUsername", orderData.telegramUsername);
    formData.append("email", orderData.userEmail);
    formData.append("gameId", "N/A");
    formData.append("serverId", "N/A");
    formData.append("gameName", "Telegram");
    
    const response = await fetch(`${API}/api/orders`, {
      method: "POST",
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Order result:', result);
    
    if (result.message && result.message.includes('Order created')) {
      alert('Order placed successfully! Admin will contact you soon.');
      closeModalHandler();
      loadWalletBalance(); // Refresh wallet balance
    } else {
      throw new Error(result.error || 'Order failed');
    }
    
  } catch (error) {
    console.error('Order submission error:', error);
    alert(`Order failed: ${error.message}`);
  } finally {
    // Reset button state
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm';
  }
}

async function loadUserData() {
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      email = user.email;
      userId = user.id;
      console.log('User email loaded:', email);
      console.log('User ID loaded:', userId);
    } else {
      console.log('No user data found');
      // Redirect to login if no user data
      window.location.href = 'login.html';
    }
  } catch (error) {
    console.error('Error loading user data:', error);
    window.location.href = 'login.html';
  }
}

async function loadWalletBalance() {
  if (!userId) return;
  
  try {
    console.log('Loading wallet balance for user ID:', userId);
    const response = await fetch(`${API}/api/wallet/${userId}`);
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Wallet data:', data);
    
    walletBalance = data.balance || 0;
    
    // Update wallet display
    const walletBalanceEl = document.getElementById('wallet-balance');
    if (walletBalanceEl) {
      walletBalanceEl.textContent = walletBalance.toLocaleString();
    }
    
  } catch (error) {
    console.error('Error loading wallet balance:', error);
    walletBalance = 0;
  }
}

// Utility function for safe JSON parsing
function safeJson(response) {
  try {
    return response.json();
  } catch (error) {
    console.error('JSON parsing error:', error);
    return null;
  }
}

// Add touch feedback for mobile
document.addEventListener('touchstart', function(e) {
  if (e.target.closest('.card')) {
    e.target.closest('.card').style.transform = 'scale(0.95)';
  }
});

document.addEventListener('touchend', function(e) {
  if (e.target.closest('.card')) {
    e.target.closest('.card').style.transform = '';
  }
});

// Add loading states and error handling
function showLoading(element) {
  if (element) {
    element.style.opacity = '0.6';
    element.style.pointerEvents = 'none';
  }
}

function hideLoading(element) {
  if (element) {
    element.style.opacity = '1';
    element.style.pointerEvents = 'auto';
  }
}
