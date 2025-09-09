// Game Accounts Page JavaScript

document.addEventListener("DOMContentLoaded", function() {
    // Initialize filter buttons
    initializeFilterButtons();
    
    // Add smooth scrolling
    document.documentElement.style.scrollBehavior = 'smooth';
});

// Filter button functionality
function initializeFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Get filter value
            const filter = this.getAttribute('data-filter');
            
            // Handle filter logic (currently all show the same message)
            handleFilter(filter);
        });
    });
}

// Handle filter selection
function handleFilter(filter) {
    console.log('Filter selected:', filter);
    
    // For now, all filters show the same "no accounts" message
    // In the future, this can be extended to show different content based on filter
    
    // Add a subtle animation to the message card
    const messageCard = document.querySelector('.message-card');
    messageCard.style.animation = 'none';
    messageCard.offsetHeight; // Trigger reflow
    messageCard.style.animation = 'fadeIn 0.6s ease-out';
}

// Telegram button functionality
function goToTelegram() {
    // Open Telegram link in new tab
    const telegramUrl = 'https://t.me/Vito12313';
    
    // Try to open in Telegram app first, fallback to web
    const telegramAppUrl = 'tg://resolve?domain=Vito12313';
    
    // Create a temporary link to handle the redirect
    const link = document.createElement('a');
    link.href = telegramAppUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    // Add click event to handle fallback
    link.addEventListener('click', function(e) {
        // If Telegram app doesn't open, try web version after a short delay
        setTimeout(() => {
            window.open(telegramUrl, '_blank', 'noopener,noreferrer');
        }, 1000);
    });
    
    // Trigger the click
    link.click();
    
    // Also try direct window.open as backup
    try {
        window.open(telegramAppUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
        console.log('Telegram app not available, opening web version');
        window.open(telegramUrl, '_blank', 'noopener,noreferrer');
    }
    
    // Add visual feedback
    const telegramBtn = document.querySelector('.telegram-btn');
    telegramBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        telegramBtn.style.transform = 'scale(1)';
    }, 150);
}

// Add keyboard support for accessibility
document.addEventListener('keydown', function(e) {
    // Enter key on filter buttons
    if (e.key === 'Enter' && e.target.classList.contains('filter-btn')) {
        e.target.click();
    }
    
    // Space key on telegram button
    if (e.key === ' ' && e.target.classList.contains('telegram-btn')) {
        e.preventDefault();
        e.target.click();
    }
});

// Add touch feedback for mobile
document.querySelectorAll('.filter-btn, .telegram-btn').forEach(button => {
    button.addEventListener('touchstart', function() {
        this.style.transform = 'scale(0.95)';
    });
    
    button.addEventListener('touchend', function() {
        this.style.transform = 'scale(1)';
    });
});

// Handle page visibility change (for when user returns from Telegram)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // Page became visible again, could add refresh logic here if needed
        console.log('Page became visible');
    }
});

// Add loading state for future functionality
function showLoading() {
    const messageCard = document.querySelector('.message-card');
    messageCard.innerHTML = `
        <div class="loading-spinner">
            <i class="bi bi-arrow-clockwise"></i>
            <p>Loading...</p>
        </div>
    `;
}

function hideLoading() {
    const messageCard = document.querySelector('.message-card');
    messageCard.innerHTML = `
        <i class="bi bi-info-circle"></i>
        <h3>လက်တလော game account များရောင်းဝယ်ရန်မရှိသေးပါ</h3>
        <p>အမြန်ဆုံးရရှိနိုင်ရန် ကျွန်ုပ်တို့၏ Telegram ကို ဆက်သွယ်ပါ</p>
    `;
}

// Export functions for potential future use
window.gameAccounts = {
    goToTelegram,
    handleFilter,
    showLoading,
    hideLoading
};
