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
document.addEventListener('DOMContentLoaded', function() {
    // Check admin authentication
    checkAdminAuth();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load dashboard data
    loadDashboard();
});

// Check admin authentication
function checkAdminAuth() {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        // Redirect to login or show login modal
        showLoginModal();
        return;
    }
    // Verify token with server
    verifyAdminToken(adminToken);
}

// Show login modal
function showLoginModal() {
    const modalBody = `
        <div class="text-center">
            <h4>Admin Login</h4>
            <form id="adminLoginForm">
                <div class="mb-3">
                    <input type="text" class="form-control" id="adminUsername" placeholder="Admin Username" required>
                </div>
                <div class="mb-3">
                    <input type="password" class="form-control" id="adminPassword" placeholder="Password" required>
                </div>
                <button type="submit" class="btn btn-primary">Login</button>
            </form>
        </div>
    `;
    
    showModal('Admin Login', modalBody, () => {
        const form = document.getElementById('adminLoginForm');
        form.addEventListener('submit', handleAdminLogin);
    });
}

// Handle admin login
async function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('adminToken', data.token);
            location.reload();
        } else {
            alert('Invalid admin credentials');
        }
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

// Verify admin token
async function verifyAdminToken(token) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            localStorage.removeItem('adminToken');
            showLoginModal();
            return;
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('adminToken');
        showLoginModal();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            switchPage(page);
        });
    });
    
    // Filter dropdowns
    const orderFilter = document.getElementById('order-status-filter');
    if (orderFilter) {
        orderFilter.addEventListener('change', () => refreshOrders());
    }
    
    const transactionFilter = document.getElementById('transaction-type-filter');
    if (transactionFilter) {
        transactionFilter.addEventListener('change', () => refreshTransactions());
    }
}

// Switch page
function switchPage(page) {
    // Update active menu item
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    
    // Show page content
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${page}-page`).classList.add('active');
    
    currentPage = page;
    
    // Load page data
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'users':
            loadUsers();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'wallet':
            loadWallets();
            break;
        case 'gifts':
            loadGifts();
            break;
    }
}

// Load dashboard data
async function loadDashboard() {
    try {
        // Load stats
        const [usersRes, ordersRes, transactionsRes] = await Promise.all([
            fetch(`${API_BASE}/api/admin/users`),
            fetch(`${API_BASE}/api/admin/orders`),
            fetch(`${API_BASE}/api/admin/transactions`)
        ]);
        
        const users = await usersRes.json();
        const orders = await ordersRes.json();
        const transactions = await transactionsRes.json();
        
        // Update stats
        document.getElementById('total-users').textContent = users.length;
        document.getElementById('total-orders').textContent = orders.length;
        document.getElementById('total-revenue').textContent = 
            transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0).toFixed(2);
        document.getElementById('pending-orders').textContent = 
            orders.filter(o => o.status === 'Pending').length;
        
        // Load recent activity
        loadRecentActivity(transactions.slice(0, 10));
        
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// Load recent activity
function loadRecentActivity(activities) {
    const container = document.getElementById('recent-activity');
    container.innerHTML = '';
    
    activities.forEach(activity => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        const iconClass = getActivityIconClass(activity.type);
        const description = getActivityDescription(activity);
        
        item.innerHTML = `
            <div class="activity-icon ${iconClass}">
                <i class="bi bi-${getActivityIcon(activity.type)}"></i>
            </div>
            <div class="activity-content">
                <h6>${description}</h6>
                <p>${activity.user_email || 'System'}</p>
            </div>
            <div class="activity-time">
                ${formatTime(activity.created_at)}
            </div>
        `;
        
        container.appendChild(item);
    });
}

// Get activity icon class
function getActivityIconClass(type) {
    const iconMap = {
        'deposit': 'transaction',
        'withdraw': 'transaction',
        'order': 'order',
        'gift': 'gift',
        'user': 'user'
    };
    return iconMap[type] || 'transaction';
}

// Get activity icon
function getActivityIcon(type) {
    const iconMap = {
        'deposit': 'arrow-down-circle',
        'withdraw': 'arrow-up-circle',
        'order': 'bag',
        'gift': 'gift',
        'user': 'person'
    };
    return iconMap[type] || 'circle';
}

// Get activity description
function getActivityDescription(activity) {
    switch(activity.type) {
        case 'deposit':
            return `Deposit of ${activity.amount} Ks`;
        case 'withdraw':
            return `Withdrawal of ${activity.amount} Ks`;
        case 'order':
            return `Order placed: ${activity.remark || 'Item'}`;
        case 'gift':
            return `Gift spin: ${activity.remark || 'Prize'}`;
        default:
            return activity.remark || 'Activity';
    }
}

// Load users
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/users`);
        const users = await response.json();
        adminData.users = users;
        
        const tbody = document.getElementById('users-table');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name || user.username}</td>
                <td>${user.email}</td>
                <td>${user.balance || 0}</td>
                <td>${user.tokens || 0}</td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    <button class="btn btn-action btn-view" onclick="viewUser(${user.id})">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-action btn-approve" onclick="editUser(${user.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Users load error:', error);
    }
}

// Load orders
async function loadOrders() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/orders`);
        const orders = await response.json();
        adminData.orders = orders;
        
        const statusFilter = document.getElementById('order-status-filter').value;
        const filteredOrders = statusFilter ? 
            orders.filter(o => o.status === statusFilter) : orders;
        
        const tbody = document.getElementById('orders-table');
        tbody.innerHTML = '';
        
        filteredOrders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.order_id}</td>
                <td>${order.user_email}</td>
                <td>${order.item}</td>
                <td>${order.price} Ks</td>
                <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
                <td>${formatDate(order.created_at)}</td>
                <td>
                    <button class="btn btn-action btn-view" onclick="viewOrder('${order.order_id}')">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${order.status === 'Pending' ? `
                        <button class="btn btn-action btn-approve" onclick="approveOrder('${order.order_id}')">
                            <i class="bi bi-check"></i>
                        </button>
                        <button class="btn btn-action btn-reject" onclick="rejectOrder('${order.order_id}')">
                            <i class="bi bi-x"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Orders load error:', error);
    }
}

// Load transactions
async function loadTransactions() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/transactions`);
        const transactions = await response.json();
        adminData.transactions = transactions;
        
        const typeFilter = document.getElementById('transaction-type-filter').value;
        const filteredTransactions = typeFilter ? 
            transactions.filter(t => t.type === typeFilter) : transactions;
        
        const tbody = document.getElementById('transactions-table');
        tbody.innerHTML = '';
        
        filteredTransactions.forEach(transaction => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${transaction.id}</td>
                <td>${transaction.user_email}</td>
                <td>${transaction.type}</td>
                <td>${transaction.amount} Ks</td>
                <td><span class="status-badge status-${transaction.status.toLowerCase()}">${transaction.status}</td>
                <td>${formatDate(transaction.created_at)}</td>
                <td>
                    <button class="btn btn-action btn-view" onclick="viewTransaction(${transaction.id})">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${transaction.status === 'Pending' && transaction.type === 'deposit' ? `
                        <button class="btn btn-action btn-approve" onclick="approveTransaction(${transaction.id})">
                            <i class="bi bi-check"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Transactions load error:', error);
    }
}

// Load wallets
async function loadWallets() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/wallets`);
        const wallets = await response.json();
        adminData.wallets = wallets;
        
        const tbody = document.getElementById('wallets-table');
        tbody.innerHTML = '';
        
        wallets.forEach(wallet => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${wallet.user_email}</td>
                <td>${wallet.balance || 0} Ks</td>
                <td>${wallet.available_balance || 0} Ks</td>
                <td>${wallet.on_hold_balance || 0} Ks</td>
                <td>${wallet.tokens || 0}</td>
                <td>
                    <button class="btn btn-action btn-view" onclick="viewWallet('${wallet.user_email}')">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-action btn-approve" onclick="editWallet('${wallet.user_email}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Wallets load error:', error);
    }
}

// Load gifts
async function loadGifts() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/gifts`);
        const gifts = await response.json();
        adminData.gifts = gifts;
        
        // Update gift stats
        const today = new Date().toISOString().split('T')[0];
        const todayGifts = gifts.filter(g => g.created_at.startsWith(today));
        document.getElementById('total-spins').textContent = todayGifts.length;
        document.getElementById('total-tokens-used').textContent = 
            todayGifts.reduce((sum, g) => sum + (g.tokens_used || 0), 0);
        
        const tbody = document.getElementById('gifts-table');
        tbody.innerHTML = '';
        
        gifts.slice(0, 50).forEach(gift => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${gift.user_email}</td>
                <td>${gift.remark || 'Prize'}</td>
                <td>${gift.amount || 0} Ks</td>
                <td><span class="status-badge status-${gift.status.toLowerCase()}">${gift.status}</td>
                <td>${formatDate(gift.created_at)}</td>
                <td>
                    <button class="btn btn-action btn-view" onclick="viewGift(${gift.id})">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Gifts load error:', error);
    }
}

// Action functions
function viewUser(userId) {
    const user = adminData.users.find(u => u.id === userId);
    if (!user) return;
    
    const modalBody = `
        <div class="row">
            <div class="col-md-6">
                <h6>User Information</h6>
                <p><strong>ID:</strong> ${user.id}</p>
                <p><strong>Name:</strong> ${user.name || user.username}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Created:</strong> ${formatDate(user.created_at)}</p>
            </div>
            <div class="col-md-6">
                <h6>Wallet Information</h6>
                <p><strong>Balance:</strong> ${user.balance || 0} Ks</p>
                <p><strong>Tokens:</strong> ${user.tokens || 0}</p>
            </div>
        </div>
    `;
    
    showModal('User Details', modalBody);
}

function editUser(userId) {
    const user = adminData.users.find(u => u.id === userId);
    if (!user) return;
    
    const modalBody = `
        <form id="editUserForm">
            <div class="mb-3">
                <label>Balance (Ks)</label>
                <input type="number" class="form-control" id="userBalance" value="${user.balance || 0}">
            </div>
            <div class="mb-3">
                <label>Tokens</label>
                <input type="number" class="form-control" id="userTokens" value="${user.tokens || 0}">
            </div>
        </form>
    `;
    
    showModal('Edit User', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            const balance = document.getElementById('userBalance').value;
            const tokens = document.getElementById('userTokens').value;
            updateUser(userId, balance, tokens);
        };
    });
}

async function updateUser(userId, balance, tokens) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balance, tokens })
        });
        
        if (response.ok) {
            alert('User updated successfully');
            loadUsers();
            closeModal();
        } else {
            alert('Update failed');
        }
    } catch (error) {
        alert('Update error: ' + error.message);
    }
}

function approveOrder(orderId) {
    const modalBody = `
        <p>Are you sure you want to approve this order?</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
    `;
    
    showModal('Approve Order', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            updateOrderStatus(orderId, 'Completed');
        };
    });
}

function rejectOrder(orderId) {
    const modalBody = `
        <p>Are you sure you want to reject this order?</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
    `;
    
    showModal('Reject Order', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            updateOrderStatus(orderId, 'Cancelled');
        };
    });
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            alert(`Order ${status.toLowerCase()} successfully`);
            loadOrders();
            closeModal();
        } else {
            alert('Update failed');
        }
    } catch (error) {
        alert('Update error: ' + error.message);
    }
}

function approveTransaction(transactionId) {
    const modalBody = `
        <p>Are you sure you want to approve this transaction?</p>
        <p><strong>Transaction ID:</strong> ${transactionId}</p>
    `;
    
    showModal('Approve Transaction', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            updateTransactionStatus(transactionId, 'Completed');
        };
    });
}

async function updateTransactionStatus(transactionId, status) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/transactions/${transactionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            alert(`Transaction ${status.toLowerCase()} successfully`);
            loadTransactions();
            closeModal();
        } else {
            alert('Update failed');
        }
    } catch (error) {
        alert('Update error: ' + error.message);
    }
}

// Refresh functions
function refreshUsers() { loadUsers(); }
function refreshOrders() { loadOrders(); }
function refreshTransactions() { loadTransactions(); }
function refreshWallets() { loadWallets(); }
function refreshGifts() { loadGifts(); }

// Utility functions
function showModal(title, body, onShow) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    const modal = new bootstrap.Modal(document.getElementById('actionModal'));
    modal.show();
    
    if (onShow) onShow();
}

function closeModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('actionModal'));
    if (modal) modal.hide();
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function logout() {
    localStorage.removeItem('adminToken');
    location.reload();
}

// Save settings
async function saveSettings() {
    const interval = document.getElementById('free-token-interval').value;
    const price = document.getElementById('token-price').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ freeTokenInterval: interval, tokenPrice: price })
        });
        
        if (response.ok) {
            alert('Settings saved successfully');
        } else {
            alert('Save failed');
        }
    } catch (error) {
        alert('Save error: ' + error.message);
    }
}
