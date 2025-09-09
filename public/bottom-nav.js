// Bottom Navigation JavaScript

// Initialize bottom navigation
function initBottomNav() {
  // Get current page to determine active nav item
  const currentPage = getCurrentPage();
  
  // Create bottom navigation HTML
  const bottomNavHTML = `
    <nav class="bottom-nav">
      <a href="game.html" class="nav-item" data-nav="game">
        <div class="nav-icon">
          <i class="bi bi-controller"></i>
        </div>
        <span class="nav-label">Game</span>
      </a>
      
      <a href="orders.html" class="nav-item" data-nav="orders">
        <div class="nav-icon">
          <i class="bi bi-bag-check"></i>
        </div>
        <span class="nav-label">Orders</span>
      </a>
      
      <a href="home.html" class="nav-item" data-nav="home">
        <div class="nav-icon">
          <i class="bi bi-house"></i>
        </div>
        <span class="nav-label">Home</span>
      </a>
      
      <a href="wallet.html" class="nav-item" data-nav="wallet">
        <div class="nav-icon">
          <i class="bi bi-wallet2"></i>
        </div>
        <span class="nav-label">Wallet</span>
      </a>
      
      <a href="account.html" class="nav-item" data-nav="account">
        <div class="nav-icon">
          <i class="bi bi-person"></i>
        </div>
        <span class="nav-label">Account</span>
      </a>
    </nav>
  `;
  
  // Add navigation to body
  document.body.insertAdjacentHTML('beforeend', bottomNavHTML);
  
  // Set active state
  setActiveNavItem(currentPage);
  
  // Add click handlers
  addNavClickHandlers();
}

// Get current page name
function getCurrentPage() {
  const path = window.location.pathname;
  const page = path.split('/').pop().split('.')[0];
  
  // Map page names to nav items
  const pageMap = {
    'game': 'game',
    'orders': 'orders', 
    'home': 'home',
    'index': 'home',
    'wallet': 'wallet',
    'account': 'account',
    'mlbbshop': 'home',
    'hokshop': 'home',
    'ucshop': 'home',
    'tgservice': 'home',
    'tiktokshop': 'home',
    'fbshop': 'home',
    'igshop': 'home',
    'gift': 'home',
    'deposit': 'wallet',
    'withdraw': 'wallet'
  };
  
  return pageMap[page] || 'home';
}

// Set active navigation item
function setActiveNavItem(activePage) {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.nav === activePage) {
      item.classList.add('active');
    }
  });
}

// Add click handlers for navigation
function addNavClickHandlers() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      // Show page transition loading
      window.showPageTransition();
      
      // Add loading state
      this.style.opacity = '0.6';
      
      // Remove loading state after navigation
      setTimeout(() => {
        this.style.opacity = '1';
      }, 100);
    });
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Only add bottom nav if not explicitly disabled
  if (!document.body.classList.contains('no-bottom-nav')) {
    initBottomNav();
  }
});

// Export functions for use in other scripts
window.BottomNav = {
  init: initBottomNav,
  setActive: setActiveNavItem,
  getCurrentPage: getCurrentPage
};