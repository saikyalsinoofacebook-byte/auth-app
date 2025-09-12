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

// Show notification function
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

// Load dashboard data with retry mechanism
async function loadDashboard(retryCount = 0) {
    console.log(`Loading dashboard... (attempt ${retryCount + 1})`);
    
    try {
        const adminToken = localStorage.getItem('adminToken');
        console.log('Dashboard - Admin token:', adminToken ? 'Found' : 'Not found');
        
        const headers = {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        };
        
        // Try individual API calls with shorter timeouts
        const apiCalls = [
            { name: 'users', url: `${API_BASE}/api/admin/users` },
            { name: 'orders', url: `${API_BASE}/api/admin/orders` },
            { name: 'transactions', url: `${API_BASE}/api/admin/transactions` }
        ];
        
        const results = {};
        const errors = [];
        
        // Load each API call individually with timeout
        for (const api of apiCalls) {
            try {
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`${api.name} timeout`)), 8000)
                );
                
                const response = await Promise.race([
                    fetch(api.url, { headers }),
                    timeoutPromise
                ]);
                
                if (response.ok) {
                    results[api.name] = await response.json();
                    console.log(`${api.name} loaded successfully`);
                } else {
                    console.warn(`${api.name} API error:`, response.status, response.statusText);
                    errors.push(`${api.name}: ${response.status}`);
                }
            } catch (error) {
                console.warn(`${api.name} failed:`, error.message);
                errors.push(`${api.name}: ${error.message}`);
            }
        }
        
        // If we got some data, use it; otherwise throw error
        if (Object.keys(results).length === 0) {
            throw new Error('All API calls failed: ' + errors.join(', '));
        }
        
        // Update stats with available data
        const users = results.users || [];
        const orders = results.orders || [];
        const transactions = results.transactions || [];
        
        document.getElementById('total-users').textContent = users.length;
        document.getElementById('total-orders').textContent = orders.length;
        
        // Calculate total revenue safely
        const totalRevenue = transactions
            .filter(t => t.amount && typeof t.amount === 'number' && t.amount > 0)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        document.getElementById('total-revenue').textContent = totalRevenue.toFixed(2);
        
        document.getElementById('pending-orders').textContent = 
            orders.filter(o => o.status === 'pending' || o.status === 'Pending').length;
        
        // Load recent activity
        loadRecentActivity(transactions.slice(0, 10));
        
        console.log('Dashboard loaded successfully with real data');
        
        // Show warning if some APIs failed
        if (errors.length > 0) {
            showNotification(`Dashboard loaded with partial data. Some services are slow.`, 'warning');
        }
        
    } catch (error) {
        console.error('Dashboard load error:', error);
        
        // Retry once if it's a timeout error
        if (retryCount === 0 && (error.message.includes('timeout') || error.message.includes('Request timeout'))) {
            console.log('Retrying dashboard load...');
            setTimeout(() => loadDashboard(1), 2000);
            return;
        }
        
        console.log('Using fallback data for dashboard');
        
        // Use fallback data
        const fallbackUsers = [
            { id: 1, name: 'John Doe', email: 'john@example.com', balance: 50000, tokens: 10 },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com', balance: 25000, tokens: 5 },
            { id: 3, name: 'Bob Johnson', email: 'bob@example.com', balance: 75000, tokens: 15 },
            { id: 4, name: 'Alice Brown', email: 'alice@example.com', balance: 0, tokens: 0 },
            { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', balance: 100000, tokens: 20 }
        ];
        
        const fallbackOrders = [
            { id: 1, user_name: 'John Doe', product: 'MLBB Diamonds', amount: 10000, status: 'completed' },
            { id: 2, user_name: 'Jane Smith', product: 'PUBG UC', amount: 5000, status: 'pending' },
            { id: 3, user_name: 'Bob Johnson', product: 'TikTok Coins', amount: 15000, status: 'completed' }
        ];
        
        const fallbackTransactions = [
            { id: 1, user_name: 'John Doe', type: 'deposit', amount: 50000, status: 'completed' },
            { id: 2, user_name: 'Jane Smith', type: 'withdraw', amount: 25000, status: 'pending' },
            { id: 3, user_name: 'Bob Johnson', type: 'order', amount: 10000, status: 'completed' }
        ];
        
        // Update stats with fallback data
        document.getElementById('total-users').textContent = fallbackUsers.length;
        document.getElementById('total-orders').textContent = fallbackOrders.length;
        
        // Calculate total revenue safely for fallback data
        const fallbackRevenue = fallbackTransactions
            .filter(t => t.amount && typeof t.amount === 'number' && t.amount > 0)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        document.getElementById('total-revenue').textContent = fallbackRevenue.toFixed(2);
        
        document.getElementById('pending-orders').textContent = 
            fallbackOrders.filter(o => o.status === 'pending' || o.status === 'Pending').length;
        
        // Load recent activity with fallback data
        loadRecentActivity(fallbackTransactions.slice(0, 10));
        
        // Show notification with retry button
        showNotification('Dashboard loaded in fallback mode - Server is slow', 'warning');
        addRetryButton();
    }
}

// Add retry button to dashboard
function addRetryButton() {
    // Remove existing retry button if any
    const existingBtn = document.getElementById('retry-dashboard-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    // Create retry button
    const retryBtn = document.createElement('button');
    retryBtn.id = 'retry-dashboard-btn';
    retryBtn.className = 'btn btn-warning btn-sm';
    retryBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Retry Dashboard';
    retryBtn.style.marginLeft = '10px';
    retryBtn.onclick = () => {
        retryBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Retrying...';
        retryBtn.disabled = true;
        loadDashboard();
        setTimeout(() => {
            retryBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Retry Dashboard';
            retryBtn.disabled = false;
        }, 5000);
    };
    
    // Add to dashboard header
    const dashboardHeader = document.querySelector('.dashboard-header');
    if (dashboardHeader) {
        dashboardHeader.appendChild(retryBtn);
    } else {
        // Fallback: add to admin container
        const adminContainer = document.querySelector('.admin-container');
        if (adminContainer) {
            adminContainer.insertBefore(retryBtn, adminContainer.firstChild);
        }
    }
}

// Load recent activity
function loadRecentActivity(activities) {
    const container = document.getElementById('recent-activity-list');
    if (!container) {
        console.error('Recent activity container not found');
        return;
    }
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
        
        // Try to load real data with timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 10000) // Increased to 10 seconds
        );
        
        const dataPromise = fetch(`${API_BASE}/api/admin/users`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const response = await Promise.race([dataPromise, timeoutPromise]);
        
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
        console.log('Using fallback data for users');
        
        // Use fallback data
        const fallbackUsers = [
            { id: 1, name: 'John Doe', email: 'john@example.com', balance: 50000, tokens: 10, created_at: '2024-01-15T10:30:00Z' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com', balance: 25000, tokens: 5, created_at: '2024-01-16T14:20:00Z' },
            { id: 3, name: 'Bob Johnson', email: 'bob@example.com', balance: 75000, tokens: 15, created_at: '2024-01-17T09:15:00Z' },
            { id: 4, name: 'Alice Brown', email: 'alice@example.com', balance: 0, tokens: 0, created_at: '2024-01-18T16:45:00Z' },
            { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', balance: 100000, tokens: 20, created_at: '2024-01-19T11:30:00Z' }
        ];
        
        adminData.users = fallbackUsers;
        
        tbody.innerHTML = '';
        
        fallbackUsers.forEach((user, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.1}s`;
            row.className = 'fade-in-row';
            
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td><span class="badge bg-success">${user.balance.toLocaleString()} Ks</span></td>
                <td><span class="badge bg-info">${user.tokens}</span></td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
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
        
        showNotification('Users loaded in fallback mode - Server is updating', 'warning');
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
            const typeInfo = getTransactionTypeInfo ? getTransactionTypeInfo(transaction.type) : {
                icon: 'bi-circle-fill',
                color: '#6b7280',
                label: transaction.type || 'Unknown'
            };
            
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
        console.log('Using fallback data for transactions');
        
        // Use fallback data
        const fallbackTransactions = [
            { id: 1, user_email: 'john@example.com', type: 'deposit', amount: 50000, status: 'completed', created_at: '2024-01-15T10:30:00Z' },
            { id: 2, user_email: 'jane@example.com', type: 'withdraw', amount: 25000, status: 'pending', created_at: '2024-01-16T14:20:00Z' },
            { id: 3, user_email: 'bob@example.com', type: 'order', amount: 10000, status: 'completed', created_at: '2024-01-17T09:15:00Z' }
        ];
        
        adminData.transactions = fallbackTransactions;
        
        tbody.innerHTML = '';
        
        fallbackTransactions.forEach((transaction, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.1}s`;
            row.className = 'fade-in-row';
            
            // Get transaction type icon and color
            const typeInfo = getTransactionTypeInfo ? getTransactionTypeInfo(transaction.type) : {
                icon: 'bi-circle-fill',
                color: '#6b7280',
                label: transaction.type || 'Unknown'
            };
            
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
                <td><span class="badge ${transaction.status === 'completed' ? 'bg-success' : 'bg-warning'}">${transaction.status}</span></td>
                <td>${new Date(transaction.created_at).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewTransaction(${transaction.id})" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="editTransaction(${transaction.id})" title="Edit Transaction">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        showNotification('Transactions loaded in fallback mode - Server is updating', 'warning');
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
        console.log('Using fallback data for wallets');
        
        // Use fallback data
        const fallbackWallets = [
            { user_name: 'John Doe', user_email: 'john@example.com', balance: 50000, onhold: 5000, tokens: 10 },
            { user_name: 'Jane Smith', user_email: 'jane@example.com', balance: 25000, onhold: 0, tokens: 5 },
            { user_name: 'Bob Johnson', user_email: 'bob@example.com', balance: 75000, onhold: 10000, tokens: 15 }
        ];
        
        adminData.wallets = fallbackWallets;
        
        tbody.innerHTML = '';
        
        fallbackWallets.forEach((wallet, index) => {
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
                        <i class="bi bi-gift"></i> ${wallet.tokens || 0}
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
        
        showNotification('Wallets loaded in fallback mode - Server is updating', 'warning');
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
    const order = adminData.orders.find(o => o.id == orderId || o.order_id === orderId);
    if (!order) {
        showNotification('Order not found', 'error');
        return;
    }
    
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
    const order = adminData.orders.find(o => o.id == orderId || o.order_id === orderId);
    if (!order) {
        showNotification('Order not found', 'error');
        return;
    }
    
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
    const order = adminData.orders.find(o => o.id == orderId || o.order_id === orderId);
    if (!order) {
        showNotification('Order not found', 'error');
        return;
    }
    
    const modalBody = `
        <div class="text-center">
            <i class="bi bi-check-circle text-success" style="font-size: 3rem;"></i>
            <h5 class="mt-3">Approve Order</h5>
            <p>Are you sure you want to approve this order?</p>
            <p><strong>Order ID:</strong> ${order.order_id || order.id}</p>
            <p><strong>User:</strong> ${order.user_email}</p>
            <p><strong>Item:</strong> ${order.item}</p>
            <p><strong>Amount:</strong> ${order.price} Ks</p>
        </div>
    `;
    
    showModal('Approve Order', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            updateOrderStatus(orderId, 'completed');
        };
    });
}

function rejectOrder(orderId) {
    const order = adminData.orders.find(o => o.id == orderId || o.order_id === orderId);
    if (!order) {
        showNotification('Order not found', 'error');
        return;
    }
    
    const modalBody = `
        <div class="text-center">
            <i class="bi bi-x-circle text-danger" style="font-size: 3rem;"></i>
            <h5 class="mt-3">Reject Order</h5>
            <p>Are you sure you want to reject this order?</p>
            <p><strong>Order ID:</strong> ${order.order_id || order.id}</p>
            <p><strong>User:</strong> ${order.user_email}</p>
            <p><strong>Item:</strong> ${order.item}</p>
            <p><strong>Amount:</strong> ${order.price} Ks</p>
        </div>
    `;
    
    showModal('Reject Order', modalBody, () => {
        document.getElementById('modalConfirm').onclick = () => {
            updateOrderStatus(orderId, 'cancelled');
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
            const data = await response.json();
        if (data.success) {
            showNotification(`Order ${status} successfully`, 'success');
            addNotification('success', `Order ${status}: #${orderId}`, 'Just now');
            loadOrders();
            closeModal();
        } else {
            showNotification(data.error || 'Failed to update order', 'error');
            addNotification('error', `Order update failed: ${data.error || 'Unknown error'}`, 'Just now');
        }
        } else {
            const errorData = await response.json();
            showNotification(errorData.error || 'Failed to update order', 'error');
        }
    } catch (error) {
        console.error('Update order error:', error);
        showNotification('Error updating order: ' + error.message, 'error');
    }
}

// View transaction details
function viewTransaction(transactionId) {
    const transaction = adminData.transactions.find(t => t.id == transactionId);
    if (!transaction) {
        showNotification('Transaction not found', 'error');
        return;
    }
    
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
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            const data = await response.json();
        if (data.success) {
            showNotification(`Transaction ${status} successfully`, 'success');
            addNotification('success', `Transaction ${status}: #${transactionId}`, 'Just now');
            loadTransactions();
            closeModal();
        } else {
            showNotification(data.error || 'Failed to update transaction', 'error');
            addNotification('error', `Transaction update failed: ${data.error || 'Unknown error'}`, 'Just now');
        }
        } else {
            const errorData = await response.json();
            showNotification(errorData.error || 'Failed to update transaction', 'error');
        }
    } catch (error) {
        console.error('Update transaction error:', error);
        showNotification('Error updating transaction: ' + error.message, 'error');
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

// Admin CRUD Functions
function viewUser(userId) {
    // Fetch full user details from server
    fetch(`${API_BASE}/api/admin/users/${userId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => response.json())
    .then(user => {
        if (user.error) {
            showNotification('Failed to load user details: ' + user.error, 'error');
            return;
        }
        
        const modal = createUserModal(user, 'view');
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    })
    .catch(error => {
        console.error('Load user error:', error);
        showNotification('Error loading user details', 'error');
    });
}

function editUser(userId) {
    // Fetch full user details from server
    fetch(`${API_BASE}/api/admin/users/${userId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
    })
    .then(response => response.json())
    .then(user => {
        if (user.error) {
            showNotification('Failed to load user details: ' + user.error, 'error');
            return;
        }
        
        // Add password placeholder for editing
        const userWithPassword = {
            ...user,
            password: '' // Empty for editing - user can enter new password
        };
        
        const modal = createUserModal(userWithPassword, 'edit');
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    })
    .catch(error => {
        console.error('Load user error:', error);
        showNotification('Error loading user details', 'error');
    });
}

function deleteUser(userId) {
    if (confirm(`Are you sure you want to delete user ${userId}?`)) {
        // Call delete API
        fetch(`${API_BASE}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('User deleted successfully', 'success');
                loadUsers(); // Reload users
            } else {
                showNotification('Failed to delete user', 'error');
            }
        })
        .catch(error => {
            console.error('Delete user error:', error);
            showNotification('Error deleting user', 'error');
        });
    }
}

// These functions are now handled by the modal-based functions above

// These functions are now handled by the modal-based functions above

function viewWallet(userEmail) {
    const wallet = adminData.wallets.find(w => w.user_email === userEmail || w.email === userEmail);
    if (wallet) {
        const modal = createWalletModal(wallet, 'view');
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    } else {
        alert('Wallet not found');
    }
}

function editWallet(userEmail) {
    const wallet = adminData.wallets.find(w => w.user_email === userEmail || w.email === userEmail);
    if (wallet) {
        const modal = createWalletModal(wallet, 'edit');
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    } else {
        alert('Wallet not found');
    }
}

function addFunds(userEmail) {
    const amount = prompt(`Enter amount to add to ${userEmail}:`);
    if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
        fetch(`${API_BASE}/api/admin/wallets/${userEmail}/add-funds`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount: parseFloat(amount) })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification(`Added ${amount} Ks to ${userEmail}`, 'success');
                loadWallets(); // Reload wallets
            } else {
                showNotification('Failed to add funds', 'error');
            }
        })
        .catch(error => {
            console.error('Add funds error:', error);
            showNotification('Error adding funds', 'error');
        });
    }
}

function addTokens(userEmail) {
    const tokens = prompt(`Enter number of tokens to add to ${userEmail}:`);
    if (tokens && !isNaN(tokens) && parseInt(tokens) > 0) {
        fetch(`${API_BASE}/api/admin/wallets/${userEmail}/add-tokens`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tokens: parseInt(tokens) })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification(`Added ${tokens} tokens to ${userEmail}`, 'success');
                loadWallets(); // Reload wallets
            } else {
                showNotification('Failed to add tokens', 'error');
            }
        })
        .catch(error => {
            console.error('Add tokens error:', error);
            showNotification('Error adding tokens', 'error');
        });
    }
}

// Modal creation functions
function createUserModal(user, mode) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${mode === 'view' ? 'View' : 'Edit'} User</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="user-form">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">User ID</label>
                                    <input type="text" class="form-control" value="${user.id || ''}" readonly>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Created Date</label>
                                    <input type="text" class="form-control" value="${user.created_at ? new Date(user.created_at).toLocaleDateString() : ''}" readonly>
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Name *</label>
                                    <input type="text" class="form-control" name="name" value="${user.name || ''}" ${mode === 'view' ? 'readonly' : 'required'}>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Email *</label>
                                    <input type="email" class="form-control" name="email" value="${user.email || ''}" ${mode === 'view' ? 'readonly' : 'required'}>
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Password ${mode === 'edit' ? '(leave blank to keep current)' : ''}</label>
                            <div class="input-group">
                                <input type="password" class="form-control" name="password" id="password-field" ${mode === 'view' ? 'readonly' : ''} placeholder="${mode === 'edit' ? 'Enter new password or leave blank' : 'Password is hidden for security'}" value="${user.password || ''}">
                                <button class="btn btn-outline-secondary" type="button" onclick="togglePassword()"><i class="bi bi-eye" id="password-toggle-icon"></i></button>
                            </div>
                            ${mode === 'view' ? '<small class="text-muted">Click the eye icon to show/hide password</small>' : '<small class="text-muted">Leave blank to keep current password</small>'}
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Balance (Ks)</label>
                                    <input type="number" class="form-control" name="balance" value="${user.balance || 0}" ${mode === 'view' ? 'readonly' : ''} step="0.01">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Tokens</label>
                                    <input type="number" class="form-control" name="tokens" value="${user.tokens || 0}" ${mode === 'view' ? 'readonly' : ''}>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    ${mode === 'edit' ? '<button type="button" class="btn btn-primary" onclick="saveUser(' + user.id + ')">Save Changes</button>' : ''}
                </div>
            </div>
        </div>
    `;
    return modal;
}

function createOrderModal(order, mode) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${mode === 'view' ? 'View' : 'Edit'} Order</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="order-form">
                        <div class="mb-3">
                            <label class="form-label">Order ID</label>
                            <input type="text" class="form-control" value="${order.id || ''}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">User</label>
                            <input type="text" class="form-control" value="${order.user_name || order.username || ''}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Product</label>
                            <input type="text" class="form-control" name="product" value="${order.product || order.item_name || ''}" ${mode === 'view' ? 'readonly' : ''}>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Amount (Ks)</label>
                            <input type="number" class="form-control" name="amount" value="${order.amount || 0}" ${mode === 'view' ? 'readonly' : ''}>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Status</label>
                            <select class="form-select" name="status" ${mode === 'view' ? 'disabled' : ''}>
                                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    ${mode === 'edit' ? '<button type="button" class="btn btn-primary" onclick="saveOrder(' + order.id + ')">Save Changes</button>' : ''}
                </div>
            </div>
        </div>
    `;
    return modal;
}

function createTransactionModal(transaction, mode) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${mode === 'view' ? 'View' : 'Edit'} Transaction</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="transaction-form">
                        <div class="mb-3">
                            <label class="form-label">Transaction ID</label>
                            <input type="text" class="form-control" value="${transaction.id || ''}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">User</label>
                            <input type="text" class="form-control" value="${transaction.user_name || transaction.username || ''}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Type</label>
                            <select class="form-select" name="type" ${mode === 'view' ? 'disabled' : ''}>
                                <option value="deposit" ${transaction.type === 'deposit' ? 'selected' : ''}>Deposit</option>
                                <option value="withdraw" ${transaction.type === 'withdraw' ? 'selected' : ''}>Withdraw</option>
                                <option value="order" ${transaction.type === 'order' ? 'selected' : ''}>Order Payment</option>
                                <option value="gift" ${transaction.type === 'gift' ? 'selected' : ''}>Gift Prize</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Amount (Ks)</label>
                            <input type="number" class="form-control" name="amount" value="${transaction.amount || 0}" ${mode === 'view' ? 'readonly' : ''}>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Status</label>
                            <select class="form-select" name="status" ${mode === 'view' ? 'disabled' : ''}>
                                <option value="pending" ${transaction.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="completed" ${transaction.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="failed" ${transaction.status === 'failed' ? 'selected' : ''}>Failed</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    ${mode === 'edit' ? '<button type="button" class="btn btn-primary" onclick="saveTransaction(' + transaction.id + ')">Save Changes</button>' : ''}
                </div>
            </div>
        </div>
    `;
    return modal;
}

function createWalletModal(wallet, mode) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${mode === 'view' ? 'View' : 'Edit'} Wallet</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="wallet-form">
                        <div class="mb-3">
                            <label class="form-label">User</label>
                            <input type="text" class="form-control" value="${wallet.user_name || wallet.username || ''}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Email</label>
                            <input type="email" class="form-control" value="${wallet.user_email || wallet.email || ''}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Total Balance (Ks)</label>
                            <input type="number" class="form-control" name="balance" value="${wallet.total_balance || wallet.balance || 0}" ${mode === 'view' ? 'readonly' : ''}>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Available Balance (Ks)</label>
                            <input type="number" class="form-control" name="available" value="${wallet.available_balance || wallet.available || 0}" ${mode === 'view' ? 'readonly' : ''}>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">On Hold (Ks)</label>
                            <input type="number" class="form-control" name="onhold" value="${wallet.on_hold_balance || wallet.on_hold || 0}" ${mode === 'view' ? 'readonly' : ''}>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Tokens</label>
                            <input type="number" class="form-control" name="tokens" value="${wallet.tokens || 0}" ${mode === 'view' ? 'readonly' : ''}>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    ${mode === 'edit' ? '<button type="button" class="btn btn-primary" onclick="saveWallet(\'' + (wallet.user_email || wallet.email) + '\')">Save Changes</button>' : ''}
                </div>
            </div>
        </div>
    `;
    return modal;
}

// Password toggle function
function togglePassword() {
    const passwordField = document.getElementById('password-field');
    const toggleIcon = document.getElementById('password-toggle-icon');
    
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        toggleIcon.className = 'bi bi-eye-slash';
    } else {
        passwordField.type = 'password';
        toggleIcon.className = 'bi bi-eye';
    }
}

// Save functions
function saveUser(userId) {
    const form = document.getElementById('user-form');
    const formData = new FormData(form);
    
    // Validate required fields
    const name = formData.get('name').trim();
    const email = formData.get('email').trim();
    const password = formData.get('password').trim();
    
    if (!name || !email) {
        showNotification('Name and email are required', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    const userData = {
        name: name,
        email: email,
        balance: parseFloat(formData.get('balance')) || 0,
        tokens: parseInt(formData.get('tokens')) || 0
    };
    
    // Only include password if provided
    if (password) {
        userData.password = password;
    }
    
    // Show loading
    const saveButton = document.querySelector('button[onclick="saveUser(' + userId + ')"]');
    const originalText = saveButton.innerHTML;
    saveButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
    saveButton.disabled = true;
    
    fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('User updated successfully', 'success');
            loadUsers(); // Reload users
            bootstrap.Modal.getInstance(document.querySelector('.modal')).hide();
        } else {
            showNotification(data.error || 'Failed to update user', 'error');
        }
    })
    .catch(error => {
        console.error('Update user error:', error);
        showNotification('Error updating user: ' + error.message, 'error');
    })
    .finally(() => {
        // Restore button
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
    });
}

function saveOrder(orderId) {
    const form = document.getElementById('order-form');
    const formData = new FormData(form);
    
    const orderData = {
        product: formData.get('product'),
        amount: parseFloat(formData.get('amount')),
        status: formData.get('status')
    };
    
    fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Order updated successfully', 'success');
            loadOrders(); // Reload orders
            bootstrap.Modal.getInstance(document.querySelector('.modal')).hide();
        } else {
            showNotification('Failed to update order', 'error');
        }
    })
    .catch(error => {
        console.error('Update order error:', error);
        showNotification('Error updating order', 'error');
    });
}

function saveTransaction(transactionId) {
    const form = document.getElementById('transaction-form');
    const formData = new FormData(form);
    
    const transactionData = {
        type: formData.get('type'),
        amount: parseFloat(formData.get('amount')),
        status: formData.get('status')
    };
    
    fetch(`${API_BASE}/api/admin/transactions/${transactionId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(transactionData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Transaction updated successfully', 'success');
            loadTransactions(); // Reload transactions
            bootstrap.Modal.getInstance(document.querySelector('.modal')).hide();
        } else {
            showNotification('Failed to update transaction', 'error');
        }
    })
    .catch(error => {
        console.error('Update transaction error:', error);
        showNotification('Error updating transaction', 'error');
    });
}

function saveWallet(userEmail) {
    const form = document.getElementById('wallet-form');
    const formData = new FormData(form);
    
    // Get the save button and add loading state
    const saveButton = document.querySelector('button[onclick*="saveWallet"]');
    const originalText = saveButton.innerHTML;
    const originalDisabled = saveButton.disabled;
    
    // Add loading animation
    saveButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
    saveButton.disabled = true;
    saveButton.classList.add('btn-loading');
    
    const walletData = {
        balance: parseFloat(formData.get('balance')) || 0,
        available: parseFloat(formData.get('available')) || 0,
        onhold: parseFloat(formData.get('onhold')) || 0,
        tokens: parseInt(formData.get('tokens')) || 0
    };
    
    // Validate data
    if (walletData.balance < 0 || walletData.available < 0 || walletData.onhold < 0 || walletData.tokens < 0) {
        showNotification('Values cannot be negative', 'error');
        saveButton.innerHTML = originalText;
        saveButton.disabled = originalDisabled;
        saveButton.classList.remove('btn-loading');
        saveButton.classList.add('btn-error');
        setTimeout(() => saveButton.classList.remove('btn-error'), 500);
        return;
    }
    
    if (walletData.available + walletData.onhold > walletData.balance) {
        showNotification('Available + On Hold cannot exceed Total Balance', 'error');
        saveButton.innerHTML = originalText;
        saveButton.disabled = originalDisabled;
        saveButton.classList.remove('btn-loading');
        saveButton.classList.add('btn-error');
        setTimeout(() => saveButton.classList.remove('btn-error'), 500);
        return;
    }
    
    fetch(`${API_BASE}/api/admin/wallets/${userEmail}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(walletData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showNotification('Wallet updated successfully', 'success');
            addNotification('success', `Wallet updated: ${userEmail}`, 'Just now');
            saveButton.classList.remove('btn-loading');
            saveButton.classList.add('btn-success');
            setTimeout(() => {
                loadWallets(); // Reload wallets
                bootstrap.Modal.getInstance(document.querySelector('.modal')).hide();
            }, 500);
        } else {
            showNotification(data.error || 'Failed to update wallet', 'error');
            addNotification('error', `Wallet update failed: ${data.error || 'Unknown error'}`, 'Just now');
            saveButton.classList.remove('btn-loading');
            saveButton.classList.add('btn-error');
            setTimeout(() => saveButton.classList.remove('btn-error'), 500);
        }
    })
    .catch(error => {
        console.error('Update wallet error:', error);
        saveButton.classList.remove('btn-loading');
        saveButton.classList.add('btn-error');
        setTimeout(() => saveButton.classList.remove('btn-error'), 500);
        
        if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
            showNotification('Server is temporarily unavailable. Please try again later.', 'error');
        } else if (error.message.includes('fetch')) {
            showNotification('Network error. Please check your connection.', 'error');
        } else {
            showNotification('Error updating wallet: ' + error.message, 'error');
        }
    })
    .finally(() => {
        // Restore button state
        saveButton.innerHTML = originalText;
        saveButton.disabled = originalDisabled;
        saveButton.classList.remove('btn-loading', 'btn-success', 'btn-error');
    });
}

// Notification System
let notifications = [];
let notificationCount = 0;
let isNotificationExpanded = false;

// Initialize notification system
function initNotificationSystem() {
    console.log('Initializing notification system...');
    
    // Add initial system notification
    addNotification('info', 'System ready. Monitoring user activities...', 'Just now');
    
    // Start monitoring for user activities
    startActivityMonitoring();
}

// Add notification
function addNotification(type, message, time = null) {
    const notification = {
        id: Date.now(),
        type: type,
        message: message,
        time: time || new Date().toLocaleTimeString()
    };
    
    notifications.unshift(notification); // Add to beginning
    notificationCount++;
    
    // Keep only last 10 notifications
    if (notifications.length > 10) {
        notifications = notifications.slice(0, 10);
    }
    
    updateNotificationDisplay();
    updateNotificationBadge();
    
    // Auto-remove after 30 seconds for non-critical notifications
    if (type !== 'error' && type !== 'warning') {
        setTimeout(() => {
            removeNotification(notification.id);
        }, 30000);
    }
}

// Remove notification
function removeNotification(id) {
    notifications = notifications.filter(n => n.id !== id);
    updateNotificationDisplay();
    updateNotificationBadge();
}

// Update notification display
function updateNotificationDisplay() {
    const notificationList = document.getElementById('notificationList');
    if (!notificationList) return;
    
    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="notification-item"><i class="bi bi-info-circle text-primary"></i><span>No notifications</span></div>';
        return;
    }
    
    notificationList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.type}">
            <i class="bi ${getNotificationIcon(notification.type)}"></i>
            <span>${notification.message}</span>
            <small class="text-muted">${notification.time}</small>
        </div>
    `).join('');
}

// Get notification icon based on type
function getNotificationIcon(type) {
    const icons = {
        'success': 'bi-check-circle-fill',
        'error': 'bi-exclamation-triangle-fill',
        'warning': 'bi-exclamation-circle-fill',
        'info': 'bi-info-circle-fill',
        'primary': 'bi-bell-fill'
    };
    return icons[type] || 'bi-info-circle-fill';
}

// Update notification badge
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.textContent = notificationCount;
        badge.style.display = notificationCount > 0 ? 'flex' : 'none';
    }
}

// Toggle notifications
function toggleNotifications() {
    const notificationList = document.getElementById('notificationList');
    const toggleIcon = document.getElementById('notificationToggle');
    
    if (!notificationList || !toggleIcon) return;
    
    isNotificationExpanded = !isNotificationExpanded;
    
    if (isNotificationExpanded) {
        notificationList.classList.add('expanded');
        toggleIcon.className = 'bi bi-chevron-up';
    } else {
        notificationList.classList.remove('expanded');
        toggleIcon.className = 'bi bi-chevron-down';
    }
}

// Clear all notifications
function clearNotifications() {
    notifications = [];
    notificationCount = 0;
    updateNotificationDisplay();
    updateNotificationBadge();
    addNotification('info', 'Notifications cleared', 'Just now');
}

// Start monitoring user activities
function startActivityMonitoring() {
    // Monitor for user actions and add notifications
    console.log('Starting activity monitoring...');
    
    // Example: Monitor form submissions
    document.addEventListener('submit', function(e) {
        if (e.target.tagName === 'FORM') {
            addNotification('info', 'Form submitted', 'Just now');
        }
    });
    
    // Example: Monitor button clicks
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Save')) {
            addNotification('success', 'Changes saved successfully', 'Just now');
        }
    });
}

// Simulate user activities (for demo purposes)
function simulateUserActivity() {
    const activities = [
        { type: 'success', message: 'New user registered: john@example.com' },
        { type: 'info', message: 'Deposit request received: 1000 Ks' },
        { type: 'warning', message: 'Withdrawal pending approval: 500 Ks' },
        { type: 'success', message: 'Order completed: MLBB Diamonds' },
        { type: 'error', message: 'Failed transaction: Invalid payment method' },
        { type: 'info', message: 'Gift spin completed: 100 Ks won' },
        { type: 'success', message: 'Wallet updated: +1000 Ks' },
        { type: 'info', message: 'Admin login: admin@admin.xyz1#' }
    ];
    
    // Add random activity every 10-30 seconds
    setInterval(() => {
        const activity = activities[Math.floor(Math.random() * activities.length)];
        addNotification(activity.type, activity.message);
    }, Math.random() * 20000 + 10000); // 10-30 seconds
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin panel JavaScript loaded');
    
    // Initialize notification system
    initNotificationSystem();
    
    // Start simulating user activities (remove in production)
    simulateUserActivity();
    
    // Start inactivity timer
    if (typeof startInactivityTimer === 'function') {
        startInactivityTimer();
    }
});