export const navigateTo = (screenId) => {
  // Hide all screens
  document.querySelectorAll('main > section').forEach(section => {
    section.classList.add('hidden');
  });
  
  // Show target screen
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.remove('hidden');
    // If target is not login or landing, show nav
    if (screenId !== 'login-screen' && screenId !== 'landing-screen') {
      document.getElementById('bottom-nav').classList.remove('hidden');
      document.getElementById('bottom-nav').classList.add('flex');
      document.getElementById('chatbot-fab').classList.remove('hidden');
    } else {
      document.getElementById('bottom-nav').classList.add('hidden');
      document.getElementById('bottom-nav').classList.remove('flex');
      document.getElementById('chatbot-fab').classList.add('hidden');
    }
  }

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.target === screenId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Scroll to top
  document.getElementById('app-content').scrollTo(0, 0);
};

export const initNavigation = () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.dataset.target;
      if (target) {
        navigateTo(target);
      }
    });
  });

  // Main scan button on home
  document.getElementById('main-scan-btn')?.addEventListener('click', () => {
    navigateTo('scanner-screen');
  });

  // Get Started button on landing page
  document.getElementById('get-started-btn')?.addEventListener('click', () => {
    navigateTo('login-screen');
  });
};

export const showLoading = (btnId, loadingText) => {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const originalText = btn.innerHTML;
  btn.dataset.original = originalText;
  btn.disabled = true;
  btn.innerHTML = `<span class="material-symbols-outlined animate-spin">progress_activity</span> ${loadingText}`;
};

export const hideLoading = (btnId) => {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (btn.dataset.original) {
    btn.innerHTML = btn.dataset.original;
  }
  btn.disabled = false;
};
