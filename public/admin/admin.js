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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminPanel);
} else {
    initializeAdminPanel();
}

// Check admin authentication
function checkAdminAuth() {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        // Redirect to login page
        window.location.href = 'login.html';
        return;
    }
    // Token exists, continue with initialization
    console.log('Admin token found, initializing panel');
}

// Verify admin token
async function verifyAdminToken(token) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
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

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Sidebar menu items
    const menuItems = document.querySelectorAll('.menu-item');
    console.log('Found menu items:', menuItems.length);
    
    menuItems.forEach((item, index) => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            console.log('Menu item clicked:', page);
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
    
    console.log('Event listeners setup complete');
}

// Switch page
function switchPage(page) {
    console.log('Switching to page:', page);
    
    // Update active menu item
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeMenuItem = document.querySelector(`[data-page="${page}"]`);
    if (activeMenuItem) {
        activeMenuItem.classList.add('active');
    } else {
        console.error('Menu item not found for page:', page);
    }
    
    // Show page content
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.remove('active');
    });
    const pageContent = document.getElementById(`${page}-page`);
    if (pageContent) {
        pageContent.classList.add('active');
    } else {
        console.error('Page content not found for:', page);
    }
    
    currentPage = page;
    
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
        default:
            console.error('Unknown page:', page);
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
    console.log('Loading users...');
    const tbody = document.getElementById('users-table');
    if (!tbody) {
        console.error('Users table not found');
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="loading"></div> Loading users...</td></tr>';
    
    try {
        const adminToken = localStorage.getItem('adminToken');
        console.log('Admin token:', adminToken ? 'Found' : 'Not found');
        
        const response = await fetch(`${API_BASE}/api/admin/users`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const users = await response.json();
        console.log('Users loaded:', users.length);
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
                <td>${user.id}</td>
                <td>${user.name || user.username || 'N/A'}</td>
                <td>${user.email}</td>
                <td><span class="badge bg-success">${user.balance || 0} Ks</span></td>
                <td><span class="badge bg-info">${user.tokens || 0}</span></td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewUser(${user.id})" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="editUser(${user.id})" title="Edit User">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${user.id})" title="Delete User">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Users load error:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading users: ' + error.message + '</td></tr>';
        
        // If it's an authentication error, redirect to login
        if (error.message.includes('401') || error.message.includes('403')) {
            localStorage.removeItem('adminToken');
            window.location.href = 'login.html';
        }
    }
}

// Load orders
async function loadOrders() {
    const tbody = document.getElementById('orders-table');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="loading"></div> Loading orders...</td></tr>';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/orders`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const orders = await response.json();
        adminData.orders = orders;
        
        const statusFilter = document.getElementById('order-status-filter').value;
        const filteredOrders = statusFilter ? 
            orders.filter(o => o.status === statusFilter) : orders;
        
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
                <td><span class="badge bg-primary">${order.order_id}</span></td>
                <td>${order.user_email}</td>
                <td>
                    <div>
                        <strong>${order.item}</strong>
                        <br><small class="text-muted">${order.game_name}</small>
                    </div>
                </td>
                <td><span class="badge bg-success">${order.price} Ks</span></td>
                <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
                <td>${formatDate(order.created_at)}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewOrder('${order.order_id}')" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${order.status === 'Pending' ? `
                            <button class="btn btn-sm btn-outline-success" onclick="approveOrder('${order.order_id}')" title="Approve Order">
                                <i class="bi bi-check"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="rejectOrder('${order.order_id}')" title="Reject Order">
                                <i class="bi bi-x"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-warning" onclick="editOrder('${order.order_id}')" title="Edit Order">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Orders load error:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading orders: ' + error.message + '</td></tr>';
    }
}

// Load transactions
async function loadTransactions() {
    const tbody = document.getElementById('transactions-table');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="loading"></div> Loading transactions...</td></tr>';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/transactions`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const transactions = await response.json();
        adminData.transactions = transactions;
        
        const typeFilter = document.getElementById('transaction-type-filter').value;
        const filteredTransactions = typeFilter ? 
            transactions.filter(t => t.type === typeFilter) : transactions;
        
        tbody.innerHTML = '';
        
        if (filteredTransactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No transactions found</td></tr>';
            return;
        }
        
        filteredTransactions.forEach((transaction, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.1}s`;
            row.className = 'fade-in-row';
            
            // Get transaction type icon and color
            const typeInfo = getTransactionTypeInfo(transaction.type);
            
            row.innerHTML = `
                <td><span class="badge bg-primary">#${transaction.id}</span></td>
                <td>${transaction.user_email}</td>
                <td>
                    <div class="transaction-type">
                        <i class="bi ${typeInfo.icon}" style="color: ${typeInfo.color}; margin-right: 0.5rem;"></i>
                        <span class="type-text">${typeInfo.label}</span>
                    </div>
                </td>
                <td>
                    <span class="amount-badge ${transaction.amount > 0 ? 'positive' : 'negative'}">
                        ${transaction.amount > 0 ? '+' : ''}${transaction.amount} Ks
                    </span>
                </td>
                <td><span class="status-badge status-${transaction.status.toLowerCase()}">${transaction.status}</span></td>
                <td>${formatDate(transaction.created_at)}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewTransaction(${transaction.id})" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${transaction.status === 'Pending' && transaction.type === 'deposit' ? `
                            <button class="btn btn-sm btn-outline-success" onclick="approveTransaction(${transaction.id})" title="Approve Transaction">
                                <i class="bi bi-check"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="rejectTransaction(${transaction.id})" title="Reject Transaction">
                                <i class="bi bi-x"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-warning" onclick="editTransaction(${transaction.id})" title="Edit Transaction">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Transactions load error:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading transactions: ' + error.message + '</td></tr>';
    }
}

// Get transaction type information
function getTransactionTypeInfo(type) {
    const typeMap = {
        'deposit': {
            icon: 'bi-arrow-down-circle-fill',
            color: '#10b981',
            label: 'Deposit'
        },
        'withdraw': {
            icon: 'bi-arrow-up-circle-fill',
            color: '#ef4444',
            label: 'Withdraw'
        },
        'order': {
            icon: 'bi-bag-fill',
            color: '#3b82f6',
            label: 'Order Payment'
        },
        'gift': {
            icon: 'bi-gift-fill',
            color: '#8b5cf6',
            label: 'Gift Prize'
        },
        'gift-token': {
            icon: 'bi-coin',
            color: '#f59e0b',
            label: 'Token Purchase'
        }
    };
    
    return typeMap[type] || {
        icon: 'bi-circle-fill',
        color: '#6b7280',
        label: type.charAt(0).toUpperCase() + type.slice(1)
    };
}

// Load wallets
async function loadWallets() {
    const tbody = document.getElementById('wallets-table');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="loading"></div> Loading wallets...</td></tr>';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/wallets`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const wallets = await response.json();
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
            
            // Calculate available balance (balance - onhold)
            const availableBalance = (wallet.balance || 0) - (wallet.onhold || 0);
            
            row.innerHTML = `
                <td>
                    <div class="wallet-user">
                        <div class="user-avatar">
                            <i class="bi bi-person-circle"></i>
                        </div>
                        <div class="user-info">
                            <strong>${wallet.user_name || 'N/A'}</strong>
                            <br><small class="text-muted">${wallet.user_email}</small>
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
                        <button class="btn btn-sm btn-outline-primary" onclick="viewWallet('${wallet.user_email}')" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="editWallet('${wallet.user_email}')" title="Edit Wallet">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="addFunds('${wallet.user_email}')" title="Add Funds">
                            <i class="bi bi-plus-circle"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="addTokens('${wallet.user_email}')" title="Add Tokens">
                            <i class="bi bi-gift"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Wallets load error:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading wallets: ' + error.message + '</td></tr>';
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

// View order details
function viewOrder(orderId) {
    const order = adminData.orders.find(o => o.order_id === orderId);
    if (!order) return;
    
    const modalBody = `
        <div class="row">
            <div class="col-md-6">
                <h6>Order Information</h6>
                <p><strong>Order ID:</strong> ${order.order_id}</p>
                <p><strong>User Email:</strong> ${order.user_email}</p>
                <p><strong>Item:</strong> ${order.item}</p>
                <p><strong>Game:</strong> ${order.game_name}</p>
                <p><strong>Game ID:</strong> ${order.game_id}</p>
                <p><strong>Server ID:</strong> ${order.server_id}</p>
                <p><strong>Price:</strong> ${order.price} Ks</p>
                <p><strong>Method:</strong> ${order.method}</p>
            </div>
            <div class="col-md-6">
                <h6>Additional Details</h6>
                <p><strong>Phone:</strong> ${order.phone || 'N/A'}</p>
                <p><strong>Recipient:</strong> ${order.recipient || 'N/A'}</p>
                <p><strong>Telegram:</strong> ${order.telegram_username || 'N/A'}</p>
                <p><strong>Status:</strong> <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></p>
                <p><strong>Created:</strong> ${formatDate(order.created_at)}</p>
                ${order.screenshot ? `
                    <p><strong>Screenshot:</strong></p>
                    <img src="${order.screenshot}" class="img-fluid" style="max-width: 200px; border-radius: 8px;">
                ` : ''}
            </div>
        </div>
    `;
    
    showModal('Order Details', modalBody);
}

// Edit order
function editOrder(orderId) {
    const order = adminData.orders.find(o => o.order_id === orderId);
    if (!order) return;
    
    const modalBody = `
        <form id="editOrderForm">
            <div class="mb-3">
                <label>Status</label>
                <select class="form-control" id="orderStatus">
                    <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </div>
            <div class="mb-3">
                <label>Price (Ks)</label>
                <input type="number" class="form-control" id="orderPrice" value="${order.price}" step="0.01">
            </div>
            <div class="mb-3">
                <label>Game ID</label>
                <input type="text" class="form-control" id="orderGameId" value="${order.game_id}">
            </div>
            <div class="mb-3">
                <label>Server ID</label>
                <input type="text" class="form-control" id="orderServerId" value="${order.server_id}">
            </div>
        </form>
    `;
    
    showModal('Edit Order', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            const status = document.getElementById('orderStatus').value;
            const price = document.getElementById('orderPrice').value;
            const gameId = document.getElementById('orderGameId').value;
            const serverId = document.getElementById('orderServerId').value;
            updateOrder(orderId, status, price, gameId, serverId);
        };
    });
}

// Update order
async function updateOrder(orderId, status, price, gameId, serverId) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status, price, gameId, serverId })
        });
        
        if (response.ok) {
            alert('Order updated successfully');
            loadOrders();
            closeModal();
        } else {
            alert('Update failed: ' + (await response.text()));
        }
    } catch (error) {
        alert('Update error: ' + error.message);
    }
}

function approveOrder(orderId) {
    const modalBody = `
        <div class="text-center">
            <i class="bi bi-check-circle text-success" style="font-size: 3rem;"></i>
            <h5 class="mt-3">Approve Order</h5>
            <p>Are you sure you want to approve this order?</p>
            <p><strong>Order ID:</strong> ${orderId}</p>
        </div>
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
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            alert(`Order ${status.toLowerCase()} successfully`);
            loadOrders();
            closeModal();
        } else {
            alert('Update failed: ' + (await response.text()));
        }
    } catch (error) {
        alert('Update error: ' + error.message);
    }
}

// View transaction details
function viewTransaction(transactionId) {
    const transaction = adminData.transactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    const typeInfo = getTransactionTypeInfo(transaction.type);
    
    const modalBody = `
        <div class="row">
            <div class="col-md-6">
                <h6>Transaction Information</h6>
                <p><strong>Transaction ID:</strong> #${transaction.id}</p>
                <p><strong>User Email:</strong> ${transaction.user_email}</p>
                <p><strong>Type:</strong> 
                    <i class="bi ${typeInfo.icon}" style="color: ${typeInfo.color}; margin-right: 0.5rem;"></i>
                    ${typeInfo.label}
                </p>
                <p><strong>Amount:</strong> 
                    <span class="amount-badge ${transaction.amount > 0 ? 'positive' : 'negative'}">
                        ${transaction.amount > 0 ? '+' : ''}${transaction.amount} Ks
                    </span>
                </p>
                <p><strong>Status:</strong> <span class="status-badge status-${transaction.status.toLowerCase()}">${transaction.status}</span></p>
                <p><strong>Created:</strong> ${formatDate(transaction.created_at)}</p>
            </div>
            <div class="col-md-6">
                <h6>Additional Details</h6>
                <p><strong>Method:</strong> ${transaction.method || 'N/A'}</p>
                <p><strong>Phone:</strong> ${transaction.phone || 'N/A'}</p>
                <p><strong>Recipient:</strong> ${transaction.recipient || 'N/A'}</p>
                <p><strong>Remark:</strong> ${transaction.remark || 'N/A'}</p>
                ${transaction.screenshot ? `
                    <p><strong>Screenshot:</strong></p>
                    <img src="${transaction.screenshot}" class="img-fluid order-screenshot" style="max-width: 200px; border-radius: 8px;">
                ` : ''}
            </div>
        </div>
    `;
    
    showModal('Transaction Details', modalBody);
}

// Edit transaction
function editTransaction(transactionId) {
    const transaction = adminData.transactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    const modalBody = `
        <form id="editTransactionForm">
            <div class="mb-3">
                <label>Status</label>
                <select class="form-control" id="transactionStatus">
                    <option value="Pending" ${transaction.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Completed" ${transaction.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Cancelled" ${transaction.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </div>
            <div class="mb-3">
                <label>Amount (Ks)</label>
                <input type="number" class="form-control" id="transactionAmount" value="${transaction.amount}" step="0.01">
            </div>
            <div class="mb-3">
                <label>Type</label>
                <select class="form-control" id="transactionType">
                    <option value="deposit" ${transaction.type === 'deposit' ? 'selected' : ''}>Deposit</option>
                    <option value="withdraw" ${transaction.type === 'withdraw' ? 'selected' : ''}>Withdraw</option>
                    <option value="order" ${transaction.type === 'order' ? 'selected' : ''}>Order Payment</option>
                    <option value="gift" ${transaction.type === 'gift' ? 'selected' : ''}>Gift Prize</option>
                    <option value="gift-token" ${transaction.type === 'gift-token' ? 'selected' : ''}>Token Purchase</option>
                </select>
            </div>
            <div class="mb-3">
                <label>Method</label>
                <input type="text" class="form-control" id="transactionMethod" value="${transaction.method || ''}">
            </div>
            <div class="mb-3">
                <label>Remark</label>
                <textarea class="form-control" id="transactionRemark" rows="3">${transaction.remark || ''}</textarea>
            </div>
        </form>
    `;
    
    showModal('Edit Transaction', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            const status = document.getElementById('transactionStatus').value;
            const amount = document.getElementById('transactionAmount').value;
            const type = document.getElementById('transactionType').value;
            const method = document.getElementById('transactionMethod').value;
            const remark = document.getElementById('transactionRemark').value;
            updateTransaction(transactionId, status, amount, type, method, remark);
        };
    });
}

// Update transaction
async function updateTransaction(transactionId, status, amount, type, method, remark) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/transactions/${transactionId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status, amount, type, method, remark })
        });
        
        if (response.ok) {
            alert('Transaction updated successfully');
            loadTransactions();
            closeModal();
        } else {
            alert('Update failed: ' + (await response.text()));
        }
    } catch (error) {
        alert('Update error: ' + error.message);
    }
}

// Reject transaction
function rejectTransaction(transactionId) {
    const modalBody = `
        <div class="text-center">
            <i class="bi bi-x-circle text-danger" style="font-size: 3rem;"></i>
            <h5 class="mt-3">Reject Transaction</h5>
            <p>Are you sure you want to reject this transaction?</p>
            <p><strong>Transaction ID:</strong> #${transactionId}</p>
        </div>
    `;
    
    showModal('Reject Transaction', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            updateTransactionStatus(transactionId, 'Cancelled');
        };
    });
}

function approveTransaction(transactionId) {
    const modalBody = `
        <div class="text-center">
            <i class="bi bi-check-circle text-success" style="font-size: 3rem;"></i>
            <h5 class="mt-3">Approve Transaction</h5>
            <p>Are you sure you want to approve this transaction?</p>
            <p><strong>Transaction ID:</strong> #${transactionId}</p>
        </div>
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

// Delete user function
async function deleteUser(userId) {
    const user = adminData.users.find(u => u.id === userId);
    if (!user) return;
    
    const modalBody = `
        <div class="text-center">
            <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
            <h5 class="mt-3">Are you sure you want to delete this user?</h5>
            <p><strong>User:</strong> ${user.name || user.username || 'N/A'}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p class="text-danger"><small>This action cannot be undone!</small></p>
        </div>
    `;
    
    showModal('Delete User', modalBody, () => {
        document.getElementById('modalConfirm').onclick = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    alert('User deleted successfully');
                    loadUsers();
                    closeModal();
                } else {
                    alert('Delete failed: ' + (await response.text()));
                }
            } catch (error) {
                alert('Delete error: ' + error.message);
            }
        };
    });
}

// View wallet details
function viewWallet(userEmail) {
    const wallet = adminData.wallets.find(w => w.user_email === userEmail);
    if (!wallet) return;
    
    const availableBalance = (wallet.balance || 0) - (wallet.onhold || 0);
    
    const modalBody = `
        <div class="row">
            <div class="col-md-6">
                <h6>User Information</h6>
                <p><strong>Name:</strong> ${wallet.user_name || 'N/A'}</p>
                <p><strong>Email:</strong> ${wallet.user_email}</p>
                <p><strong>Created:</strong> ${formatDate(wallet.created_at)}</p>
                <p><strong>Last Free Token:</strong> ${wallet.last_free_token_at ? formatDate(wallet.last_free_token_at) : 'Never'}</p>
            </div>
            <div class="col-md-6">
                <h6>Wallet Information</h6>
                <p><strong>Total Balance:</strong> 
                    <span class="balance-badge total-balance">${(wallet.balance || 0).toLocaleString()} Ks</span>
                </p>
                <p><strong>Available Balance:</strong> 
                    <span class="balance-badge available-balance">${availableBalance.toLocaleString()} Ks</span>
                </p>
                <p><strong>On Hold:</strong> 
                    <span class="balance-badge onhold-balance">${(wallet.onhold || 0).toLocaleString()} Ks</span>
                </p>
                <p><strong>Tokens:</strong> 
                    <span class="token-badge">
                        <i class="bi bi-coin"></i>
                        ${wallet.tokens || 0}
                    </span>
                </p>
            </div>
        </div>
    `;
    
    showModal('Wallet Details', modalBody);
}

// Edit wallet
function editWallet(userEmail) {
    const wallet = adminData.wallets.find(w => w.user_email === userEmail);
    if (!wallet) return;
    
    const modalBody = `
        <form id="editWalletForm">
            <div class="mb-3">
                <label>Total Balance (Ks)</label>
                <input type="number" class="form-control" id="walletBalance" value="${wallet.balance || 0}" step="0.01">
            </div>
            <div class="mb-3">
                <label>On Hold Balance (Ks)</label>
                <input type="number" class="form-control" id="walletOnhold" value="${wallet.onhold || 0}" step="0.01">
            </div>
            <div class="mb-3">
                <label>Tokens</label>
                <input type="number" class="form-control" id="walletTokens" value="${wallet.tokens || 0}">
            </div>
        </form>
    `;
    
    showModal('Edit Wallet', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            const balance = document.getElementById('walletBalance').value;
            const onhold = document.getElementById('walletOnhold').value;
            const tokens = document.getElementById('walletTokens').value;
            updateWallet(userEmail, balance, onhold, tokens);
        };
    });
}

// Update wallet
async function updateWallet(userEmail, balance, onhold, tokens) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/wallets/${encodeURIComponent(userEmail)}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ balance, onhold, tokens })
        });
        
        if (response.ok) {
            alert('Wallet updated successfully');
            loadWallets();
            closeModal();
        } else {
            alert('Update failed: ' + (await response.text()));
        }
    } catch (error) {
        alert('Update error: ' + error.message);
    }
}

// Add funds to wallet
function addFunds(userEmail) {
    const wallet = adminData.wallets.find(w => w.user_email === userEmail);
    if (!wallet) return;
    
    const modalBody = `
        <form id="addFundsForm">
            <div class="mb-3">
                <label>Amount to Add (Ks)</label>
                <input type="number" class="form-control" id="fundAmount" placeholder="Enter amount" step="0.01" required>
            </div>
            <div class="mb-3">
                <label>Reason</label>
                <select class="form-control" id="fundReason">
                    <option value="admin_adjustment">Admin Adjustment</option>
                    <option value="refund">Refund</option>
                    <option value="bonus">Bonus</option>
                    <option value="correction">Correction</option>
                </select>
            </div>
            <div class="mb-3">
                <label>Notes</label>
                <textarea class="form-control" id="fundNotes" rows="3" placeholder="Optional notes"></textarea>
            </div>
        </form>
    `;
    
    showModal('Add Funds', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            const amount = document.getElementById('fundAmount').value;
            const reason = document.getElementById('fundReason').value;
            const notes = document.getElementById('fundNotes').value;
            processAddFunds(userEmail, amount, reason, notes);
        };
    });
}

// Process add funds
async function processAddFunds(userEmail, amount, reason, notes) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/wallets/${encodeURIComponent(userEmail)}/add-funds`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount, reason, notes })
        });
        
        if (response.ok) {
            alert('Funds added successfully');
            loadWallets();
            closeModal();
        } else {
            alert('Add funds failed: ' + (await response.text()));
        }
    } catch (error) {
        alert('Add funds error: ' + error.message);
    }
}

// Add tokens to wallet
function addTokens(userEmail) {
    const wallet = adminData.wallets.find(w => w.user_email === userEmail);
    if (!wallet) return;
    
    const modalBody = `
        <form id="addTokensForm">
            <div class="mb-3">
                <label>Tokens to Add</label>
                <input type="number" class="form-control" id="tokenAmount" placeholder="Enter number of tokens" required>
            </div>
            <div class="mb-3">
                <label>Reason</label>
                <select class="form-control" id="tokenReason">
                    <option value="admin_gift">Admin Gift</option>
                    <option value="bonus">Bonus</option>
                    <option value="compensation">Compensation</option>
                    <option value="promotion">Promotion</option>
                </select>
            </div>
            <div class="mb-3">
                <label>Notes</label>
                <textarea class="form-control" id="tokenNotes" rows="3" placeholder="Optional notes"></textarea>
            </div>
        </form>
    `;
    
    showModal('Add Tokens', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            const amount = document.getElementById('tokenAmount').value;
            const reason = document.getElementById('tokenReason').value;
            const notes = document.getElementById('tokenNotes').value;
            processAddTokens(userEmail, amount, reason, notes);
        };
    });
}

// Process add tokens
async function processAddTokens(userEmail, amount, reason, notes) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/wallets/${encodeURIComponent(userEmail)}/add-tokens`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount, reason, notes })
        });
        
        if (response.ok) {
            alert('Tokens added successfully');
            loadWallets();
            closeModal();
        } else {
            alert('Add tokens failed: ' + (await response.text()));
        }
    } catch (error) {
        alert('Add tokens error: ' + error.message);
    }
}

// Mobile menu functions
function toggleMobileMenu() {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.querySelector('.mobile-menu-overlay');
    
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    } else {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function closeMobileMenu() {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.querySelector('.mobile-menu-overlay');
    
    sidebar.classList.remove('open');
    overlay.style.display = 'none';
    document.body.style.overflow = '';
}

// Close mobile menu when clicking on menu items
function setupMobileMenu() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
        });
    });
}

// Handle window resize
function handleResize() {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.querySelector('.mobile-menu-overlay');
    
    if (window.innerWidth > 768) {
        sidebar.classList.remove('open');
        overlay.style.display = 'none';
        document.body.style.overflow = '';
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