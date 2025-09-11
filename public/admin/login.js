// Admin Login JavaScript
const API_BASE = "https://arthur-game-shop.onrender.com";

// Initialize login page
document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    checkExistingAuth();
    
    // Setup form submission
    setupLoginForm();
    
    // Add security notice
    addSecurityNotice();
});

// Check existing authentication
function checkExistingAuth() {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
        // Verify token and redirect if valid
        verifyAndRedirect(adminToken);
    }
}

// Verify token and redirect
async function verifyAndRedirect(token) {
    try {
        console.log('Verifying existing token...');
        const response = await fetch(`${API_BASE}/api/admin/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Token verification response:', response.status);
        
        if (response.ok) {
            console.log('Token is valid, redirecting to admin panel');
            window.location.href = 'index.html';
        } else {
            console.log('Token is invalid, removing from storage');
            localStorage.removeItem('adminToken');
        }
    } catch (error) {
        console.log('Token verification error:', error);
        localStorage.removeItem('adminToken');
    }
}

// Setup login form
function setupLoginForm() {
    const form = document.getElementById('adminLoginForm');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('adminUsername').value.trim();
        const password = document.getElementById('adminPassword').value;
        
        // Validate inputs
        if (!username || !password) {
            showError('Please fill in all fields');
            return;
        }
        
        // Show loading state
        setLoadingState(true);
        hideError();
        
        try {
            console.log('Attempting admin login...');
            const response = await fetch(`${API_BASE}/api/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            console.log('Login response status:', response.status);
            const data = await response.json();
            console.log('Login response data:', data);
            
            if (response.ok && data.token) {
                // Login successful
                console.log('Login successful, storing token');
                localStorage.setItem('adminToken', data.token);
                
                // Show success animation
                showSuccessAnimation();
                
                // Redirect after short delay
                setTimeout(() => {
                    console.log('Redirecting to admin panel...');
                    window.location.href = 'index.html';
                }, 1500);
                
            } else {
                // Login failed
                console.log('Login failed:', data.error);
                showError(data.error || 'Invalid credentials. Please try again.');
                shakeForm();
            }
            
        } catch (error) {
            console.error('Login error:', error);
            showError('Network error. Please check your connection and try again.');
            shakeForm();
        } finally {
            setLoadingState(false);
        }
    });
    
    // Add input animations
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
        });
    });
}

// Set loading state
function setLoadingState(loading) {
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoading = loginBtn.querySelector('.btn-loading');
    
    if (loading) {
        loginBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
    } else {
        loginBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

// Hide error message
function hideError() {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.display = 'none';
}

// Shake form animation
function shakeForm() {
    const form = document.getElementById('adminLoginForm');
    form.style.animation = 'shake 0.5s ease-in-out';
    
    setTimeout(() => {
        form.style.animation = '';
    }, 500);
}

// Show success animation
function showSuccessAnimation() {
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    
    loginBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    btnText.textContent = 'Login Successful!';
    
    // Add success icon
    const successIcon = document.createElement('i');
    successIcon.className = 'bi bi-check-circle';
    successIcon.style.marginRight = '0.5rem';
    
    btnText.insertBefore(successIcon, btnText.firstChild);
}

// Add security notice
function addSecurityNotice() {
    const notice = document.createElement('div');
    notice.className = 'security-notice';
    notice.innerHTML = '🔒 Secure Admin Access - Authorized Personnel Only';
    document.body.appendChild(notice);
}

// Prevent right-click and F12 (basic security)
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

document.addEventListener('keydown', function(e) {
    // Disable F12, Ctrl+Shift+I, Ctrl+U
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
    }
});

// Auto-focus on username field
window.addEventListener('load', function() {
    document.getElementById('adminUsername').focus();
});

// Handle page visibility change (security)
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden, could be a security concern
        console.log('Admin login page hidden');
    }
});

// Prevent back button (basic security)
window.addEventListener('popstate', function(e) {
    // Push current state to prevent back navigation
    history.pushState(null, null, location.href);
});

// Push initial state
history.pushState(null, null, location.href);
