// ======================
// Loading Animation Component
// ======================

class LoadingAnimation {
  constructor() {
    this.overlay = null;
    this.pageLoading = null;
  }

  // Show full screen loading overlay
  showOverlay(text = "Loading...", subtext = "") {
    this.hideOverlay(); // Remove any existing overlay
    
    this.overlay = document.createElement('div');
    this.overlay.className = 'loading-overlay';
    this.overlay.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">${text}</p>
        ${subtext ? `<p class="loading-subtext">${subtext}</p>` : ''}
      </div>
    `;
    
    document.body.appendChild(this.overlay);
    document.body.style.overflow = 'hidden'; // Prevent scrolling
  }

  // Hide full screen loading overlay
  hideOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      document.body.style.overflow = ''; // Restore scrolling
    }
  }

  // Show page transition loading
  showPageLoading() {
    this.hidePageLoading(); // Remove any existing page loading
    
    this.pageLoading = document.createElement('div');
    this.pageLoading.className = 'page-loading';
    this.pageLoading.innerHTML = `
      <div class="loading-spinner"></div>
    `;
    
    document.body.appendChild(this.pageLoading);
  }

  // Hide page transition loading
  hidePageLoading() {
    if (this.pageLoading) {
      this.pageLoading.remove();
      this.pageLoading = null;
    }
  }

  // Set button to loading state
  setButtonLoading(button, text = "Loading...") {
    if (!button) return;
    
    button.disabled = true;
    button.classList.add('btn-loading');
    button.dataset.originalText = button.textContent;
    button.textContent = text;
  }

  // Remove button loading state
  removeButtonLoading(button) {
    if (!button) return;
    
    button.disabled = false;
    button.classList.remove('btn-loading');
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }

  // Show inline loading spinner
  showInlineLoading(element, text = "Loading...") {
    if (!element) return;
    
    element.innerHTML = `
      <span class="loading-inline"></span>${text}
    `;
  }

  // Hide inline loading spinner
  hideInlineLoading(element, originalText = "") {
    if (!element) return;
    
    element.innerHTML = originalText;
  }

  // Show loading with timeout
  showWithTimeout(text = "Loading...", subtext = "", timeout = 10000) {
    this.showOverlay(text, subtext);
    
    setTimeout(() => {
      this.hideOverlay();
    }, timeout);
  }

  // Check if loading is currently shown
  isShowing() {
    return this.overlay !== null || this.pageLoading !== null;
  }
}

// Create global instance
window.loadingAnimation = new LoadingAnimation();

// ======================
// Page Transition Helper
// ======================

window.showPageTransition = function() {
  window.loadingAnimation.showPageLoading();
};

window.hidePageTransition = function() {
  window.loadingAnimation.hidePageLoading();
};

// ======================
// API Call Helper
// ======================

window.apiCallWithLoading = async function(url, options = {}, loadingText = "Loading...", button = null) {
  // Show loading
  if (button) {
    window.loadingAnimation.setButtonLoading(button, loadingText);
  } else {
    window.loadingAnimation.showOverlay(loadingText);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    return { success: true, data, response };
  } catch (error) {
    console.error('API call failed:', error);
    return { success: false, error };
  } finally {
    // Hide loading
    if (button) {
      window.loadingAnimation.removeButtonLoading(button);
    } else {
      window.loadingAnimation.hideOverlay();
    }
  }
};

// ======================
// Auto page transition detection
// ======================

document.addEventListener('DOMContentLoaded', function() {
  // Add loading to all internal links
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href]');
    if (link && link.hostname === window.location.hostname) {
      const href = link.getAttribute('href');
      
      // Skip if it's a hash link or same page
      if (href.startsWith('#') || href === window.location.pathname) {
        return;
      }
      
      // Show page transition loading
      window.showPageTransition();
      
      // Hide after a short delay (page will load)
      setTimeout(() => {
        window.hidePageTransition();
      }, 1000);
    }
  });

  // Hide loading when page is fully loaded
  window.addEventListener('load', function() {
    window.hidePageTransition();
  });
});
