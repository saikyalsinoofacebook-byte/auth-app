// Facebook Services JavaScript

const API = "https://arthur-game-shop.onrender.com";

// State
let email = null;
let walletBalance = 0;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Facebook Services page loaded');
  loadUserData();
  loadWalletBalance();
});

function goToHome() {
  window.location.href = 'home.html';
}

async function loadUserData() {
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      user = JSON.parse(userData);
      email = user.email;
      console.log('User data loaded:', user);
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
  if (!email) return;
  
  try {
    console.log('Loading wallet balance for:', email);
    const response = await fetch(`${API}/api/wallet/${user.id}`);
    
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
