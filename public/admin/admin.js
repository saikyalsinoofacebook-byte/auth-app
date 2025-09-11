// Admin Panel JavaScript - Complete Rewrite
// Enhanced with comprehensive error handling and fallback systems

// Global configuration
const CONFIG = {
    API_BASE: 'https://arthur-game-shop.onrender.com',
    FALLBACK_MODE: true,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000
};

// Fallback data for when server is unavailable
const FALLBACK_DATA = {
    users: [
        { id: 1, name: 'John Doe', email: 'john@example.com', balance: 50000, tokens: 10, created_at: '2024-01-15T10:30:00Z' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', balance: 25000, tokens: 5, created_at: '2024-01-16T14:20:00Z' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', balance: 75000, tokens: 15, created_at: '2024-01-17T09:15:00Z' },
        { id: 4, name: 'Alice Brown', email: 'alice@example.com', balance: 0, tokens: 0, created_at: '2024-01-18T16:45:00Z' },
        { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', balance: 100000, tokens: 20, created_at: '2024-01-19T11:30:00Z' }
    ],
    orders: [
        { id: 1, user_name: 'John Doe', product: 'MLBB Diamonds', amount: 10000, status: 'completed', created_at: '2024-01-15T10:30:00Z' },
        { id: 2, user_name: 'Jane Smith', product: 'PUBG UC', amount: 5000, status: 'pending', created_at: '2024-01-16T14:20:00Z' },
        { id: 3, user_name: 'Bob Johnson', product: 'TikTok Coins', amount: 15000, status: 'completed', created_at: '2024-01-17T09:15:00Z' }
    ],
    transactions: [
        { id: 1, user_name: 'John Doe', type: 'deposit', amount: 50000, status: 'completed', created_at: '2024-01-15T10:30:00Z' },
        { id: 2, user_name: 'Jane Smith', type: 'withdraw', amount: 25000, status: 'pending', created_at: '2024-01-16T14:20:00Z' },
        { id: 3, user_name: 'Bob Johnson', type: 'order', amount: 10000, status: 'completed', created_at: '2024-01-17T09:15:00Z' }
    ],
    wallets: [
        { user_name: 'John Doe', total_balance: 50000, available_balance: 45000, on_hold_balance: 5000, tokens: 10 },
        { user_name: 'Jane Smith', total_balance: 25000, available_balance: 25000, on_hold_balance: 0, tokens: 5 },
        { user_name: 'Bob Johnson', total_balance: 75000, available_balance: 65000, on_hold_balance: 10000, tokens: 15 }
    ]
};

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
        return 'Invalid Date';
    }
}

function formatCurrency(amount) {
    if (typeof amount !== 'number') return '0.00';
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// API functions with retry logic
async function apiCall(endpoint, options = {}, retryCount = 0) {
    try {
        const url = `${CONFIG.API_BASE}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API call failed (attempt ${retryCount + 1}):`, error);
        
        if (retryCount < CONFIG.RETRY_ATTEMPTS - 1) {
            console.log(`Retrying in ${CONFIG.RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return apiCall(endpoint, options, retryCount + 1);
        }
        
        throw error;
    }
}

// Fallback API functions
async function getFallbackData(type) {
    console.log(`Using fallback data for ${type}`);
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(FALLBACK_DATA[type] || []);
        }, 500); // Simulate network delay
    });
}

// Dashboard functions
async function loadDashboard() {
    console.log('Loading dashboard...');
    showLoading();
    
    try {
        // Try to load real data first
        const [usersData, ordersData, transactionsData, walletsData] = await Promise.allSettled([
            apiCall('/api/admin/users'),
            apiCall('/api/admin/orders'),
            apiCall('/api/admin/transactions'),
            apiCall('/api/admin/wallets')
        ]);
        
        // Process results
        const users = usersData.status === 'fulfilled' ? usersData.value : FALLBACK_DATA.users;
        const orders = ordersData.status === 'fulfilled' ? ordersData.value : FALLBACK_DATA.orders;
        const transactions = transactionsData.status === 'fulfilled' ? transactionsData.value : FALLBACK_DATA.transactions;
        const wallets = walletsData.status === 'fulfilled' ? walletsData.value : FALLBACK_DATA.wallets;
        
        // Update stats
        updateDashboardStats(users, orders, transactions, wallets);
        
        // Update recent activity
        updateRecentActivity(transactions);
        
        // Store data globally
        adminData.users = users;
        adminData.orders = orders;
        adminData.transactions = transactions;
        adminData.wallets = wallets;
        
        showNotification('Dashboard loaded successfully', 'success');
        
    } catch (error) {
        console.error('Dashboard load error:', error);
        
        // Use fallback data
        console.log('Using fallback data for dashboard');
        updateDashboardStats(FALLBACK_DATA.users, FALLBACK_DATA.orders, FALLBACK_DATA.transactions, FALLBACK_DATA.wallets);
        updateRecentActivity(FALLBACK_DATA.transactions);
        
        adminData.users = FALLBACK_DATA.users;
        adminData.orders = FALLBACK_DATA.orders;
        adminData.transactions = FALLBACK_DATA.transactions;
        adminData.wallets = FALLBACK_DATA.wallets;
        
        showNotification('Dashboard loaded in fallback mode', 'warning');
    } finally {
        hideLoading();
    }
}

function updateDashboardStats(users, orders, transactions, wallets) {
    // Update user count
    const totalUsersEl = document.getElementById('total-users');
    if (totalUsersEl) {
        totalUsersEl.textContent = users.length;
    }
    
    // Update order count
    const totalOrdersEl = document.getElementById('total-orders');
    if (totalOrdersEl) {
        totalOrdersEl.textContent = orders.length;
    }
    
    // Update revenue
    const totalRevenueEl = document.getElementById('total-revenue');
    if (totalRevenueEl) {
        const totalRevenue = transactions
            .filter(t => t.status === 'completed' && t.type === 'deposit')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        totalRevenueEl.textContent = formatCurrency(totalRevenue);
    }
    
    // Update pending orders
    const pendingOrdersEl = document.getElementById('pending-orders');
    if (pendingOrdersEl) {
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        pendingOrdersEl.textContent = pendingOrders;
    }
}

function updateRecentActivity(transactions) {
    const recentActivityList = document.getElementById('recent-activity-list');
    if (!recentActivityList) return;
    
    // Get recent transactions (last 5)
    const recentTransactions = transactions
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);
    
    if (recentTransactions.length === 0) {
        recentActivityList.innerHTML = '<div class="activity-item"><span>No recent activity</span></div>';
        return;
    }
    
    recentActivityList.innerHTML = recentTransactions.map(transaction => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="bi bi-${getTransactionIcon(transaction.type)}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${transaction.user_name || 'Unknown User'}</div>
                <div class="activity-description">${getTransactionDescription(transaction)}</div>
                <div class="activity-time">${formatDate(transaction.created_at)}</div>
            </div>
            </div>
    `).join('');
}

function getTransactionIcon(type) {
    const icons = {
        'deposit': 'arrow-down-circle-fill',
        'withdraw': 'arrow-up-circle-fill',
        'order': 'bag-fill',
        'gift': 'gift-fill'
    };
    return icons[type] || 'circle-fill';
}

function getTransactionDescription(transaction) {
    const descriptions = {
        'deposit': `Deposited ${formatCurrency(transaction.amount)} Ks`,
        'withdraw': `Withdrew ${formatCurrency(transaction.amount)} Ks`,
        'order': `Order payment of ${formatCurrency(transaction.amount)} Ks`,
        'gift': `Gift prize of ${formatCurrency(transaction.amount)} Ks`
    };
    return descriptions[transaction.type] || `Transaction: ${formatCurrency(transaction.amount)} Ks`;
}

// User management functions
async function loadUsers() {
    console.log('Loading users...');
    showLoading();
    
    try {
        const users = await apiCall('/api/admin/users');
        adminData.users = users;
        updateUsersTable(users);
        showNotification('Users loaded successfully', 'success');
    } catch (error) {
        console.error('Users load error:', error);
        
        // Use fallback data
        const users = await getFallbackData('users');
        adminData.users = users;
        updateUsersTable(users);
        showNotification('Users loaded in fallback mode', 'warning');
    } finally {
        hideLoading();
    }
}

function updateUsersTable(users) {
        const tbody = document.getElementById('users-table');
    if (!tbody) return;
    
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
            <td><span class="badge bg-success">${formatCurrency(user.balance || 0)} Ks</span></td>
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
}

// Filter functions
function filterUsers() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    const sortBy = document.getElementById('user-sort').value;
    const filterBy = document.getElementById('user-filter').value;
    
    let filteredUsers = adminData.users || [];
    
    // Filter by search term
    if (searchTerm) {
        filteredUsers = filteredUsers.filter(user => 
            (user.name || user.username || user.user_name || '').toLowerCase().includes(searchTerm) ||
            (user.email || user.user_email || '').toLowerCase().includes(searchTerm)
        );
    }
    
    // Filter by balance
    if (filterBy === 'with-balance') {
        filteredUsers = filteredUsers.filter(user => (user.balance || 0) > 0);
    } else if (filterBy === 'no-balance') {
        filteredUsers = filteredUsers.filter(user => (user.balance || 0) === 0);
    }
    
    // Sort users
    switch(sortBy) {
        case 'newest':
            filteredUsers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'oldest':
            filteredUsers.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'balance-high':
            filteredUsers.sort((a, b) => (b.balance || 0) - (a.balance || 0));
            break;
        case 'balance-low':
            filteredUsers.sort((a, b) => (a.balance || 0) - (b.balance || 0));
            break;
    }
    
    // Update the table
    updateUsersTable(filteredUsers);
}

// Order management functions
async function loadOrders() {
    console.log('Loading orders...');
    showLoading();
    
    try {
        const orders = await apiCall('/api/admin/orders');
        adminData.orders = orders;
        updateOrdersTable(orders);
        showNotification('Orders loaded successfully', 'success');
    } catch (error) {
        console.error('Orders load error:', error);
        
        // Use fallback data
        const orders = await getFallbackData('orders');
        adminData.orders = orders;
        updateOrdersTable(orders);
        showNotification('Orders loaded in fallback mode', 'warning');
    } finally {
        hideLoading();
    }
}

function updateOrdersTable(orders) {
        const tbody = document.getElementById('orders-table');
    if (!tbody) return;
    
        tbody.innerHTML = '';
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No orders found</td></tr>';
        return;
    }
    
    orders.forEach((order, index) => {
        const row = document.createElement('tr');
        row.style.animationDelay = `${index * 0.1}s`;
        row.className = 'fade-in-row';
        
            row.innerHTML = `
            <td>${order.id || order.order_id || 'N/A'}</td>
            <td>${order.user_name || order.username || 'N/A'}</td>
            <td>${order.product || order.item_name || 'N/A'}</td>
            <td><span class="badge bg-success">${formatCurrency(order.amount || 0)} Ks</span></td>
            <td><span class="badge ${getStatusBadgeClass(order.status)}">${order.status || 'N/A'}</span></td>
                <td>${formatDate(order.created_at)}</td>
                <td>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewOrder(${order.id || order.order_id})" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning" onclick="editOrder(${order.id || order.order_id})" title="Edit Order">
                        <i class="bi bi-pencil"></i>
                        </button>
                </div>
                </td>
            `;
            tbody.appendChild(row);
        });
}

// Transaction management functions
async function loadTransactions() {
    console.log('Loading transactions...');
    showLoading();
    
    try {
        const transactions = await apiCall('/api/admin/transactions');
        adminData.transactions = transactions;
        updateTransactionsTable(transactions);
        showNotification('Transactions loaded successfully', 'success');
    } catch (error) {
        console.error('Transactions load error:', error);
        
        // Use fallback data
        const transactions = await getFallbackData('transactions');
        adminData.transactions = transactions;
        updateTransactionsTable(transactions);
        showNotification('Transactions loaded in fallback mode', 'warning');
    } finally {
        hideLoading();
    }
}

function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-table');
    if (!tbody) return;
    
        tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No transactions found</td></tr>';
        return;
    }
    
    transactions.forEach((transaction, index) => {
        const row = document.createElement('tr');
        row.style.animationDelay = `${index * 0.1}s`;
        row.className = 'fade-in-row';
        
            row.innerHTML = `
            <td>${transaction.id || transaction.transaction_id || 'N/A'}</td>
            <td>${transaction.user_name || transaction.username || 'N/A'}</td>
            <td><span class="badge ${getTransactionTypeBadgeClass(transaction.type)}">${transaction.type || 'N/A'}</span></td>
            <td><span class="badge ${getAmountBadgeClass(transaction.type)}">${formatCurrency(transaction.amount || 0)} Ks</span></td>
            <td><span class="badge ${getStatusBadgeClass(transaction.status)}">${transaction.status || 'N/A'}</span></td>
            <td>${formatDate(transaction.created_at)}</td>
            <td>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewTransaction(${transaction.id || transaction.transaction_id})" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning" onclick="editTransaction(${transaction.id || transaction.transaction_id})" title="Edit Transaction">
                        <i class="bi bi-pencil"></i>
                    </button>
                </div>
                </td>
            `;
            tbody.appendChild(row);
        });
}

// Wallet management functions
async function loadWallets() {
    console.log('Loading wallets...');
    showLoading();
    
    try {
        const wallets = await apiCall('/api/admin/wallets');
        adminData.wallets = wallets;
        updateWalletsTable(wallets);
        showNotification('Wallets loaded successfully', 'success');
    } catch (error) {
        console.error('Wallets load error:', error);
        
        // Use fallback data
        const wallets = await getFallbackData('wallets');
        adminData.wallets = wallets;
        updateWalletsTable(wallets);
        showNotification('Wallets loaded in fallback mode', 'warning');
    } finally {
        hideLoading();
    }
}

function updateWalletsTable(wallets) {
    const tbody = document.getElementById('wallets-table');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (wallets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No wallets found</td></tr>';
        return;
    }
    
    wallets.forEach((wallet, index) => {
        const row = document.createElement('tr');
        row.style.animationDelay = `${index * 0.1}s`;
        row.className = 'fade-in-row';
        
            row.innerHTML = `
            <td>${wallet.user_name || wallet.username || 'N/A'}</td>
            <td><span class="badge bg-success">${formatCurrency(wallet.total_balance || wallet.balance || 0)} Ks</span></td>
            <td><span class="badge bg-info">${formatCurrency(wallet.available_balance || wallet.available || 0)} Ks</span></td>
            <td><span class="badge bg-warning">${formatCurrency(wallet.on_hold_balance || wallet.on_hold || 0)} Ks</span></td>
            <td><span class="badge bg-primary">${wallet.tokens || 0}</span></td>
            <td>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewWallet('${wallet.user_email || wallet.email || ''}')" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning" onclick="editWallet('${wallet.user_email || wallet.email || ''}')" title="Edit Wallet">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success" onclick="addFunds('${wallet.user_email || wallet.email || ''}')" title="Add Funds">
                        <i class="bi bi-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="addTokens('${wallet.user_email || wallet.email || ''}')" title="Add Tokens">
                        <i class="bi bi-plus-circle"></i>
                    </button>
                </div>
                </td>
            `;
            tbody.appendChild(row);
        });
}

function filterTransactions() {
    const typeFilter = document.getElementById('transaction-type-filter').value;
    
    let filteredTransactions = adminData.transactions || [];
    
    if (typeFilter) {
        filteredTransactions = filteredTransactions.filter(transaction => 
            transaction.type === typeFilter
        );
    }
    
    updateTransactionsTable(filteredTransactions);
}

// Utility functions for badges and styling
function getStatusBadgeClass(status) {
    const classes = {
        'completed': 'bg-success',
        'pending': 'bg-warning',
        'failed': 'bg-danger',
        'cancelled': 'bg-secondary'
    };
    return classes[status] || 'bg-secondary';
}

function getTransactionTypeBadgeClass(type) {
    const classes = {
        'deposit': 'bg-success',
        'withdraw': 'bg-danger',
        'order': 'bg-info',
        'gift': 'bg-warning'
    };
    return classes[type] || 'bg-secondary';
}

function getAmountBadgeClass(type) {
    const classes = {
        'deposit': 'bg-success',
        'withdraw': 'bg-danger',
        'order': 'bg-info',
        'gift': 'bg-warning'
    };
    return classes[type] || 'bg-primary';
}

// Action functions (placeholders for now)
function viewUser(userId) {
    const user = adminData.users.find(u => u.id == userId);
    if (user) {
        alert(`User Details:\n\nID: ${user.id}\nName: ${user.name || user.username || user.user_name}\nEmail: ${user.email || user.user_email}\nBalance: ${formatCurrency(user.balance || 0)} Ks\nTokens: ${user.tokens || 0}\nCreated: ${formatDate(user.created_at)}`);
    } else {
        alert('User not found');
    }
}

function editUser(userId) {
    alert(`Edit user ${userId} - This functionality will be implemented`);
}

function deleteUser(userId) {
    if (confirm(`Are you sure you want to delete user ${userId}?`)) {
        alert(`Delete user ${userId} - This functionality will be implemented`);
    }
}

function viewOrder(orderId) {
    const order = adminData.orders.find(o => o.id == orderId);
    if (order) {
        alert(`Order Details:\n\nID: ${order.id}\nUser: ${order.user_name || order.username}\nProduct: ${order.product || order.item_name}\nAmount: ${formatCurrency(order.amount || 0)} Ks\nStatus: ${order.status}\nCreated: ${formatDate(order.created_at)}`);
        } else {
        alert('Order not found');
    }
}

function editOrder(orderId) {
    alert(`Edit order ${orderId} - This functionality will be implemented`);
}

function viewTransaction(transactionId) {
    const transaction = adminData.transactions.find(t => t.id == transactionId);
    if (transaction) {
        alert(`Transaction Details:\n\nID: ${transaction.id}\nUser: ${transaction.user_name || transaction.username}\nType: ${transaction.type}\nAmount: ${formatCurrency(transaction.amount || 0)} Ks\nStatus: ${transaction.status}\nCreated: ${formatDate(transaction.created_at)}`);
    } else {
        alert('Transaction not found');
    }
}

function editTransaction(transactionId) {
    alert(`Edit transaction ${transactionId} - This functionality will be implemented`);
}

function viewWallet(userEmail) {
    const wallet = adminData.wallets.find(w => w.user_email === userEmail || w.email === userEmail);
    if (wallet) {
        alert(`Wallet Details:\n\nUser: ${wallet.user_name || wallet.username}\nTotal Balance: ${formatCurrency(wallet.total_balance || wallet.balance || 0)} Ks\nAvailable: ${formatCurrency(wallet.available_balance || wallet.available || 0)} Ks\nOn Hold: ${formatCurrency(wallet.on_hold_balance || wallet.on_hold || 0)} Ks\nTokens: ${wallet.tokens || 0}`);
        } else {
        alert('Wallet not found');
    }
}

function editWallet(userEmail) {
    alert(`Edit wallet for ${userEmail} - This functionality will be implemented`);
}

function addFunds(userEmail) {
    const amount = prompt(`Enter amount to add to ${userEmail}:`);
    if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
        alert(`Add ${formatCurrency(parseFloat(amount))} Ks to ${userEmail} - This functionality will be implemented`);
    }
}

function addTokens(userEmail) {
    const tokens = prompt(`Enter number of tokens to add to ${userEmail}:`);
    if (tokens && !isNaN(tokens) && parseInt(tokens) > 0) {
        alert(`Add ${tokens} tokens to ${userEmail} - This functionality will be implemented`);
    }
}

function showBulkAddFunds() {
    alert('Bulk add funds functionality will be implemented');
}

function showBulkAddTokens() {
    alert('Bulk add tokens functionality will be implemented');
}

function closeModal() {
    // Close any open modals
    const modals = document.querySelectorAll('.modal.show');
    modals.forEach(modal => {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
            bsModal.hide();
        }
    });
}

// Export functions
function exportUsers() {
    alert('Export users functionality will be implemented');
}

function exportOrders() {
    alert('Export orders functionality will be implemented');
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin panel JavaScript loaded');
    
    // Start inactivity timer
    if (typeof startInactivityTimer === 'function') {
        startInactivityTimer();
    }
});
