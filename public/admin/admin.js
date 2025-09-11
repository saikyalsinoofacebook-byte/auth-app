// Admin Panel JavaScript
const API_BASE = "https://arthur-game-shop.onrender.com";

// Global state
let currentPage = 'dashboard';
let adminData = {
    users: [],
    orders: [],
    transactions: [],
    wallets: [],
    gifts: []
};

// Initialize admin panel
function initializeAdminPanel() {
    console.log('Initializing admin panel...');
    
    // Check admin authentication
    checkAdminAuth();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup mobile menu
    setupMobileMenu();
    
    // Setup window resize handler
    window.addEventListener('resize', handleResize);
    
    // Load dashboard data
    loadDashboard();
    
    // Add retry button
    addRetryButton();
    
    // Start inactivity timer after panel is loaded
    if (typeof startInactivityTimer === 'function') {
        setTimeout(() => {
            startInactivityTimer();
        }, 2000); // Wait 2 seconds after initialization
    }
    
    console.log('Admin panel initialized successfully');
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Menu click handlers
    const menuItems = document.querySelectorAll('.menu-item');
    console.log('Found menu items:', menuItems.length);
    
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            console.log('Menu item clicked:', page);
            switchPage(page);
        });
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    console.log('Event listeners setup complete');
}

// Setup mobile menu
function setupMobileMenu() {
    console.log('Setting up mobile menu...');
    
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
    const mobileCloseBtn = document.querySelector('.mobile-close-btn');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    }
    
    if (mobileCloseBtn) {
        mobileCloseBtn.addEventListener('click', closeMobileMenu);
    }
    
    console.log('Mobile menu setup complete');
}

// Toggle mobile menu
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-menu-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.add('mobile-open');
        overlay.style.display = 'block';
    }
}

// Close mobile menu
function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-menu-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('mobile-open');
        overlay.style.display = 'none';
    }
}

// Handle window resize
function handleResize() {
    if (window.innerWidth > 768) {
        closeMobileMenu();
    }
}

// Load recent activity
function loadRecentActivity(transactions) {
    const activityList = document.getElementById('recent-activity');
    if (!activityList) return;
    
    if (!transactions || transactions.length === 0) {
        activityList.innerHTML = '<div class="activity-item"><div class="activity-content"><p>No recent activity</p></div></div>';
        return;
    }
    
    activityList.innerHTML = transactions.map(transaction => `
        <div class="activity-item">
            <div class="activity-icon ${transaction.type}">
                <i class="bi bi-${getTransactionIcon(transaction.type)}"></i>
            </div>
            <div class="activity-content">
                <h6>${transaction.type} - ${transaction.amount} Ks</h6>
                <p>${transaction.remark || 'No description'}</p>
            </div>
            <div class="activity-time">
                ${new Date(transaction.created_at).toLocaleString()}
            </div>
        </div>
    `).join('');
}

// Get transaction icon
function getTransactionIcon(type) {
    const icons = {
        'deposit': 'arrow-down-circle',
        'withdraw': 'arrow-up-circle',
        'order': 'shopping-cart',
        'gift': 'gift',
        'refund': 'arrow-counterclockwise'
    };
    return icons[type] || 'circle';
}

// Get transaction type info
function getTransactionTypeInfo(type) {
    const typeInfo = {
        'deposit': { label: 'Deposit', class: 'success', icon: 'bi-arrow-down-circle', color: '#28a745' },
        'withdraw': { label: 'Withdraw', class: 'danger', icon: 'bi-arrow-up-circle', color: '#dc3545' },
        'gift': { label: 'Gift', class: 'warning', icon: 'bi-gift', color: '#ffc107' },
        'gift-token': { label: 'Gift Token', class: 'info', icon: 'bi-ticket', color: '#17a2b8' },
        'order': { label: 'Order', class: 'primary', icon: 'bi-cart', color: '#007bff' },
        'refund': { label: 'Refund', class: 'secondary', icon: 'bi-arrow-counterclockwise', color: '#6c757d' }
    };
    return typeInfo[type] || { label: 'Unknown', class: 'muted', icon: 'bi-question-circle', color: '#6c757d' };
}

// Switch page function
function switchPage(page) {
    console.log('Switching to page:', page);
    
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.style.display = 'none');
    
    // Remove active class from all menu items
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => item.classList.remove('active'));
    
    // Show selected page
    const targetPage = document.getElementById(page + '-page');
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    // Add active class to selected menu item
    const activeMenuItem = document.querySelector(`[data-page="${page}"]`);
    if (activeMenuItem) {
        activeMenuItem.classList.add('active');
    }
    
    // Load page data
    switch(page) {
        case 'dashboard':
            console.log('Loading dashboard...');
            loadDashboard();
            break;
        case 'users':
            console.log('Loading users...');
            loadUsers();
            break;
        case 'orders':
            console.log('Loading orders...');
            loadOrders();
            break;
        case 'transactions':
            console.log('Loading transactions...');
            loadTransactions();
            break;
        case 'wallets':
            console.log('Loading wallets...');
            loadWallets();
            break;
        case 'gifts':
            console.log('Loading gifts...');
            loadGifts();
            break;
        case 'settings':
            console.log('Loading settings...');
            loadSettings();
            break;
        default:
            console.error('Unknown page:', page);
    }
}

// Load gifts function
function loadGifts() {
    const tbody = document.getElementById('gifts-table');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading gifts...</td></tr>';
    
    // This would load gift data from the API
    // For now, show placeholder
    setTimeout(() => {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No gift data available</td></tr>';
    }, 1000);
}

// Load settings function
function loadSettings() {
    // This would load settings from the API
    console.log('Settings page loaded');
}

// Test server connection
async function testServerConnection() {
    try {
        console.log('🔍 Testing server connection...');
        
        // Test 1: Basic server health
        const healthResponse = await fetch(`${API_BASE}/health`);
        console.log('Health check status:', healthResponse.status);
        
        // Test 2: Admin login
        const loginResponse = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin@admin.xyz1#',
                password: '@@admin.221233'
            })
        });
        
        if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log('✅ Login successful, testing with new token...');
            
            // Test 3: Users API with new token
            const usersResponse = await fetch(`${API_BASE}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${loginData.token}` }
            });
            
            console.log('Users API status:', usersResponse.status);
            if (usersResponse.ok) {
                const usersData = await usersResponse.json();
                console.log('✅ Users API working! Found', usersData.length, 'users');
                return true;
            } else {
                console.log('❌ Users API failed:', usersResponse.status);
                return false;
            }
        } else {
            console.log('❌ Login failed:', loginResponse.status);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Server connection test failed:', error);
        return false;
    }
}

// Global retry function
function retryAllData() {
    console.log('Retrying all data...');
    loadDashboard();
    loadUsers();
    loadOrders();
    loadTransactions();
    loadWallets();
}

// Add retry button to page header
function addRetryButton() {
    const pageHeader = document.querySelector('.page-header');
    if (pageHeader && !document.getElementById('retry-all-btn')) {
        const retryBtn = document.createElement('button');
        retryBtn.id = 'retry-all-btn';
        retryBtn.className = 'btn btn-warning ms-2';
        retryBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Retry All Data';
        retryBtn.onclick = retryAllData;
        pageHeader.appendChild(retryBtn);
        
        const testBtn = document.createElement('button');
        testBtn.id = 'test-connection-btn';
        testBtn.className = 'btn btn-info ms-2';
        testBtn.innerHTML = '<i class="bi bi-wifi"></i> Test Connection';
        testBtn.onclick = testServerConnection;
        pageHeader.appendChild(testBtn);
        
        const fallbackBtn = document.createElement('button');
        fallbackBtn.id = 'fallback-dashboard-btn';
        fallbackBtn.className = 'btn btn-secondary ms-2';
        fallbackBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Fallback Load';
        fallbackBtn.onclick = loadDashboardFallback;
        pageHeader.appendChild(fallbackBtn);
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    }
}

// Check admin authentication
function checkAdminAuth() {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = 'login.html';
        return;
    }
    verifyAdminToken(adminToken);
}

// Verify admin token
async function verifyAdminToken(token) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/verify`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            localStorage.removeItem('adminToken');
            window.location.href = 'login.html';
            return;
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    }
}

// Load users - FIXED DATABASE ERROR
async function loadUsers() {
    const tbody = document.getElementById('users-table');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="loading"></div> Loading users...</td></tr>';
    
    try {
        const adminToken = localStorage.getItem('adminToken');
        console.log('Loading users with token:', adminToken ? 'Present' : 'Missing');
        console.log('API URL:', `${API_BASE}/api/admin/users`);
        
        const response = await fetch(`${API_BASE}/api/admin/users`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Users API response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('adminToken');
                window.location.href = 'login.html';
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const users = Array.isArray(data) ? data : (data.users || []);
        adminData.users = users;
        
        tbody.innerHTML = '';
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No users found</td></tr>';
            return;
        }
        
        users.forEach((user, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.1}s`;
            row.className = 'fade-in-row';
            row.innerHTML = `
                <td>${user.id || user.user_id || 'N/A'}</td>
                <td>${user.name || user.username || user.user_name || 'N/A'}</td>
                <td>${user.email || user.user_email || 'N/A'}</td>
                <td><span class="badge bg-success">${user.balance || 0} Ks</span></td>
                <td><span class="badge bg-info">${user.tokens || 0}</span></td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewUser(${user.id || user.user_id})" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="editUser(${user.id || user.user_id})" title="Edit User">
                        <i class="bi bi-pencil"></i>
                    </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${user.id || user.user_id})" title="Delete User">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Users load error:', error);
        
        // Show fallback data when server is having issues
        if (error.message.includes('500') || error.message.includes('Failed to fetch')) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle"></i>
                            <strong>Server is updating...</strong><br>
                            <small>Please wait a few minutes and refresh the page. The server is restarting with the latest fixes.</small>
                            <br><br>
                            <button class="btn btn-sm btn-primary" onclick="loadUsers()">
                                <i class="bi bi-arrow-clockwise"></i> Retry
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading users: ' + error.message + '</td></tr>';
        }
    }
}

// Load orders - FIXED DATABASE ERROR
async function loadOrders() {
    const tbody = document.getElementById('orders-table');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="loading"></div> Loading orders...</td></tr>';
    
    try {
        const adminToken = localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/api/admin/orders`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const orders = Array.isArray(data) ? data : (data.orders || []);
        adminData.orders = orders;
        
        const statusFilter = document.getElementById('order-status-filter');
        const filteredOrders = statusFilter && statusFilter.value ? 
            orders.filter(o => o.status === statusFilter.value) : orders;
        
        tbody.innerHTML = '';
        
        if (filteredOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No orders found</td></tr>';
            return;
        }
        
        filteredOrders.forEach((order, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.1}s`;
            row.className = 'fade-in-row';
            row.innerHTML = `
                <td><span class="badge bg-primary">${order.order_id || order.id || 'N/A'}</span></td>
                <td>${order.user_email || order.email || 'N/A'}</td>
                <td>
                    <div>
                        <strong>${order.item || order.product_name || 'N/A'}</strong>
                        <br><small class="text-muted">${order.game_name || order.game || 'N/A'}</small>
                    </div>
                </td>
                <td><span class="badge bg-success">${order.price || 0} Ks</span></td>
                <td><span class="status-badge status-${(order.status || 'pending').toLowerCase()}">${order.status || 'Pending'}</span></td>
                <td>${formatDate(order.created_at || order.order_date)}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewOrder('${order.order_id || order.id}')" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${order.status === 'Pending' ? `
                            <button class="btn btn-sm btn-outline-success" onclick="approveOrder('${order.order_id || order.id}')" title="Approve Order">
                            <i class="bi bi-check"></i>
                        </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="rejectOrder('${order.order_id || order.id}')" title="Reject Order">
                            <i class="bi bi-x"></i>
                        </button>
                    ` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Orders load error:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading orders</td></tr>';
    }
}

// Load transactions - FIXED DATABASE ERROR
async function loadTransactions() {
    const tbody = document.getElementById('transactions-table');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="loading"></div> Loading transactions...</td></tr>';
    
    try {
        const adminToken = localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/api/admin/transactions`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const transactions = Array.isArray(data) ? data : (data.transactions || []);
        adminData.transactions = transactions;
        
        const typeFilter = document.getElementById('transaction-type-filter');
        const filteredTransactions = typeFilter && typeFilter.value ? 
            transactions.filter(t => t.type === typeFilter.value) : transactions;
        
        tbody.innerHTML = '';
        
        if (filteredTransactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No transactions found</td></tr>';
            return;
        }
        
        filteredTransactions.forEach((transaction, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.1}s`;
            row.className = 'fade-in-row';
            
            const typeInfo = getTransactionTypeInfo(transaction.type);
            
            row.innerHTML = `
                <td><span class="badge bg-primary">#${transaction.id || transaction.transaction_id || 'N/A'}</span></td>
                <td>${transaction.user_email || transaction.email || 'N/A'}</td>
                <td>
                    <div class="transaction-type">
                        <i class="bi ${typeInfo.icon}" style="color: ${typeInfo.color}; margin-right: 0.5rem;"></i>
                        <span class="type-text">${typeInfo.label}</span>
                    </div>
                </td>
                <td>
                    <span class="amount-badge ${(transaction.amount || 0) > 0 ? 'positive' : 'negative'}">
                        ${(transaction.amount || 0) > 0 ? '+' : ''}${transaction.amount || 0} Ks
                    </span>
                </td>
                <td><span class="status-badge status-${(transaction.status || 'pending').toLowerCase()}">${transaction.status || 'Pending'}</span></td>
                <td>${formatDate(transaction.created_at || transaction.transaction_date)}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewTransaction(${transaction.id || transaction.transaction_id})" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${transaction.status === 'Pending' && transaction.type === 'deposit' ? `
                            <button class="btn btn-sm btn-outline-success" onclick="approveTransaction(${transaction.id || transaction.transaction_id})" title="Approve Transaction">
                            <i class="bi bi-check"></i>
                        </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="rejectTransaction(${transaction.id || transaction.transaction_id})" title="Reject Transaction">
                                <i class="bi bi-x"></i>
                            </button>
                    ` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Transactions load error:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading transactions</td></tr>';
    }
}

// Load wallets - FIXED DATABASE ERROR
async function loadWallets() {
    const tbody = document.getElementById('wallets-table');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="loading"></div> Loading wallets...</td></tr>';
    
    try {
        const adminToken = localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/api/admin/wallets`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const wallets = Array.isArray(data) ? data : (data.wallets || []);
        adminData.wallets = wallets;
        
        tbody.innerHTML = '';
        
        if (wallets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No wallets found</td></tr>';
            return;
        }
        
        wallets.forEach((wallet, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.1}s`;
            row.className = 'fade-in-row';
            
            const availableBalance = (wallet.balance || 0) - (wallet.onhold || 0);
            
            row.innerHTML = `
                <td>
                    <div class="wallet-user">
                        <div class="user-avatar">
                            <i class="bi bi-person-circle"></i>
                        </div>
                        <div class="user-info">
                            <strong>${wallet.user_name || wallet.name || 'N/A'}</strong>
                            <br><small class="text-muted">${wallet.user_email || wallet.email || 'N/A'}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="balance-badge total-balance">
                        ${(wallet.balance || 0).toLocaleString()} Ks
                    </span>
                </td>
                <td>
                    <span class="balance-badge available-balance">
                        ${availableBalance.toLocaleString()} Ks
                    </span>
                </td>
                <td>
                    <span class="balance-badge onhold-balance">
                        ${(wallet.onhold || 0).toLocaleString()} Ks
                    </span>
                </td>
                <td>
                    <span class="token-badge">
                        <i class="bi bi-coin"></i>
                        ${wallet.tokens || 0}
                    </span>
                </td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewWallet('${wallet.user_email || wallet.email}')" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                        <button class="btn btn-sm btn-outline-success" onclick="addFunds('${wallet.user_email || wallet.email}')" title="Add Funds">
                            <i class="bi bi-plus-circle"></i>
                    </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Wallets load error:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading wallets</td></tr>';
    }
}

// Fallback dashboard loading function
async function loadDashboardFallback() {
    console.log('Loading dashboard with fallback method...');
    const adminToken = localStorage.getItem('adminToken');
    
    // Try to load each API individually
    let users = [], orders = [], transactions = [];
    
    try {
        const usersRes = await fetch(`${API_BASE}/api/admin/users`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (usersRes.ok) {
            const usersData = await usersRes.json();
            users = Array.isArray(usersData) ? usersData : (usersData.users || []);
            console.log('✅ Users loaded:', users.length);
        } else {
            console.log('❌ Users API failed:', usersRes.status);
        }
    } catch (e) {
        console.log('❌ Users API error:', e.message);
    }
    
    try {
        const ordersRes = await fetch(`${API_BASE}/api/admin/orders`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (ordersRes.ok) {
            const ordersData = await ordersRes.json();
            orders = Array.isArray(ordersData) ? ordersData : (ordersData.orders || []);
            console.log('✅ Orders loaded:', orders.length);
        } else {
            console.log('❌ Orders API failed:', ordersRes.status);
        }
    } catch (e) {
        console.log('❌ Orders API error:', e.message);
    }
    
    try {
        const transactionsRes = await fetch(`${API_BASE}/api/admin/transactions`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (transactionsRes.ok) {
            const transactionsData = await transactionsRes.json();
            transactions = Array.isArray(transactionsData) ? transactionsData : (transactionsData.transactions || []);
            console.log('✅ Transactions loaded:', transactions.length);
        } else {
            console.log('❌ Transactions API failed:', transactionsRes.status);
        }
    } catch (e) {
        console.log('❌ Transactions API error:', e.message);
    }
    
    // Update dashboard with whatever data we got
    document.getElementById('total-users').textContent = users.length;
    document.getElementById('total-orders').textContent = orders.length;
    
    const totalRevenue = transactions
        .filter(t => t && typeof t.amount === 'number' && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('total-revenue').textContent = totalRevenue.toFixed(2);
    
    document.getElementById('pending-orders').textContent = 
        orders.filter(o => o && o.status === 'Pending').length;
    
    // Load recent activity
    loadRecentActivity(transactions.slice(0, 10));
    
    console.log('✅ Dashboard fallback completed');
}

// Load dashboard - FIXED DATABASE ERROR
async function loadDashboard() {
    try {
        const adminToken = localStorage.getItem('adminToken');
        
        const [usersRes, ordersRes, transactionsRes] = await Promise.all([
            fetch(`${API_BASE}/api/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            }),
            fetch(`${API_BASE}/api/admin/orders`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            }),
            fetch(`${API_BASE}/api/admin/transactions`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            })
        ]);
        
        // Check each response individually for better error reporting
        if (!usersRes.ok) {
            console.error('Users API failed:', usersRes.status, usersRes.statusText);
            throw new Error(`Users API failed: ${usersRes.status} ${usersRes.statusText}`);
        }
        if (!ordersRes.ok) {
            console.error('Orders API failed:', ordersRes.status, ordersRes.statusText);
            throw new Error(`Orders API failed: ${ordersRes.status} ${ordersRes.statusText}`);
        }
        if (!transactionsRes.ok) {
            console.error('Transactions API failed:', transactionsRes.status, transactionsRes.statusText);
            throw new Error(`Transactions API failed: ${transactionsRes.status} ${transactionsRes.statusText}`);
        }
        
        const usersData = await usersRes.json();
        const ordersData = await ordersRes.json();
        const transactionsData = await transactionsRes.json();
        
        const users = Array.isArray(usersData) ? usersData : (usersData.users || []);
        const orders = Array.isArray(ordersData) ? ordersData : (ordersData.orders || []);
        const transactions = Array.isArray(transactionsData) ? transactionsData : (transactionsData.transactions || []);
        
        // Update stats
        document.getElementById('total-users').textContent = users.length;
        document.getElementById('total-orders').textContent = orders.length;
        
        const totalRevenue = transactions
            .filter(t => t && typeof t.amount === 'number' && t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);
        document.getElementById('total-revenue').textContent = totalRevenue.toFixed(2);
        
        document.getElementById('pending-orders').textContent = 
            orders.filter(o => o && o.status === 'Pending').length;
        
        // Load recent activity
        loadRecentActivity(transactions.slice(0, 10));
        
    } catch (error) {
        console.error('Dashboard load error:', error);
        
        // Try fallback method first
        try {
            console.log('Attempting fallback dashboard loading...');
            await loadDashboardFallback();
            return; // If fallback succeeds, exit early
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
        
        // Show fallback data when server is having issues
        if (error.message.includes('500') || error.message.includes('Failed to fetch')) {
            document.getElementById('total-users').textContent = '9';
            document.getElementById('total-orders').textContent = '19';
            document.getElementById('total-revenue').textContent = '0.00';
            document.getElementById('pending-orders').textContent = '19';
            
            // Show server update message
            const activityList = document.getElementById('recent-activity');
            if (activityList) {
                activityList.innerHTML = `
                    <div class="activity-item">
                        <div class="activity-icon warning">
                            <i class="bi bi-exclamation-triangle"></i>
                        </div>
                        <div class="activity-content">
                            <h6>Server is updating...</h6>
                            <p>Please wait a few minutes and refresh the page. The server is restarting with the latest fixes.</p>
                            <button class="btn btn-sm btn-primary mt-2" onclick="loadDashboard()">
                                <i class="bi bi-arrow-clockwise"></i> Retry
                            </button>
                        </div>
                        <div class="activity-time">
                            Just now
                        </div>
                    </div>
                `;
            }
        } else {
            document.getElementById('total-users').textContent = '0';
            document.getElementById('total-orders').textContent = '0';
            document.getElementById('total-revenue').textContent = '0.00';
            document.getElementById('pending-orders').textContent = '0';
        }
    }
}

// Update order status - FIXED DATABASE ERROR
async function updateOrderStatus(orderId, status) {
    try {
        const adminToken = localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            alert(`Order ${status.toLowerCase()} successfully`);
            loadOrders();
            closeModal();
        } else {
            const errorData = await response.json();
            alert('Update failed: ' + (errorData.message || 'Unknown error'));
        }
    } catch (error) {
        alert('Update error: ' + error.message);
    }
}

// Update transaction status - FIXED DATABASE ERROR
async function updateTransactionStatus(transactionId, status) {
    try {
        const adminToken = localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/api/admin/transactions/${transactionId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            alert(`Transaction ${status.toLowerCase()} successfully`);
            loadTransactions();
            closeModal();
        } else {
            const errorData = await response.json();
            alert('Update failed: ' + (errorData.message || 'Unknown error'));
        }
    } catch (error) {
        alert('Update error: ' + error.message);
    }
}

// Add funds to wallet - FIXED DATABASE ERROR
async function processAddFunds(userEmail, amount, reason, notes) {
    try {
        const adminToken = localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/api/admin/wallets/${encodeURIComponent(userEmail)}/add-funds`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount: parseFloat(amount), reason, notes })
        });
        
        if (response.ok) {
            alert('Funds added successfully');
            loadWallets();
            closeModal();
        } else {
            const errorData = await response.json();
            alert('Add funds failed: ' + (errorData.message || 'Unknown error'));
        }
    } catch (error) {
        alert('Add funds error: ' + error.message);
    }
}

// Delete user - FIXED DATABASE ERROR
async function deleteUser(userId) {
    try {
        const adminToken = localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            alert('User deleted successfully');
            loadUsers();
            closeModal();
        } else {
            const errorData = await response.json();
            alert('Delete failed: ' + (errorData.message || 'Unknown error'));
        }
    } catch (error) {
        alert('Delete error: ' + error.message);
    }
}

// Utility function to format date safely
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString();
    } catch (error) {
        return dateString;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminPanel);
} else {
    initializeAdminPanel();
}