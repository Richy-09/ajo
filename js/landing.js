/* landing.js — Landing page interactions */

(function () {
  'use strict';

  /* ── Session check ────────────────────────────────────── */
  const SESSION_KEY = 'ajo_user';

  function isLoggedIn() {
    try {
      const ls = localStorage.getItem(SESSION_KEY);
      const ss = sessionStorage.getItem(SESSION_KEY);
      const result = !!(JSON.parse(ls || ss || 'null'));
      console.log('[landing.js] isLoggedIn:', result, '| localStorage:', ls, '| sessionStorage:', ss);
      return result;
    } catch {
      return false;
    }
  }

  /* ── App pages that require login ────────────────────── */
  // Any href containing these paths will be intercepted
  const PROTECTED_PAGES = {
    'dashboard.html':           'Dashboard',
    'members.html':             'Members',
    'contributions.html':       'Contributions',
    'payments.html':            'Payments',
    'reports.html':             'Reports',
    'profile.html':             'Profile',
    'settings.html':            'Settings',
    'user-dashboard.html':      'My Dashboard',
    'user-contributions.html':  'My Contributions',
    'user-payments.html':       'My Payments',
    'user-reports.html':        'My Reports',
    'user-profile.html':        'My Profile',
  };

  function getProtectedLabel(href) {
    if (!href) return null;
    for (const [path, label] of Object.entries(PROTECTED_PAGES)) {
      if (href.includes(path)) return { path, label };
    }
    return null;
  }

  /* ── Intercept ALL clicks on protected links ──────────── */
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;

    const href  = anchor.getAttribute('href');
    const found = getProtectedLabel(href);
    if (!found) return;

    // Already logged in — allow navigation
    if (isLoggedIn()) return;

    // Not logged in — redirect to login with context
    e.preventDefault();
    window.location.href = `login.html?next=${encodeURIComponent(found.path)}&page=${encodeURIComponent(found.label)}`;
  });

  /* ── Update nav links visual state + logged-in UI ────── */
  function updateNavState() {
    const loggedIn = isLoggedIn();

    // Remove any stale lock styling — nav links always look normal
    document.querySelectorAll('.lp-nav__links a, .lp-drawer__links a').forEach(a => {
      a.style.opacity = '';
      a.style.cursor  = '';
      a.removeAttribute('data-locked');
      a.querySelector('.lp-lock-icon')?.remove();
    });

    // Swap Sign In / Get Started buttons for a "Go to Dashboard" + logout if logged in
    const actionsEl = document.querySelector('.lp-nav__actions');
    if (actionsEl && loggedIn) {
      try {
        const user = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || 'null');
        const dashHref = user?.role === 'admin' ? 'dashboard.html' : 'user-dashboard.html';
        const firstName = (user?.name || 'Account').split(' ')[0];

        actionsEl.innerHTML = `
          <a href="${dashHref}" class="lp-nav__register" style="gap:6px;">
            <i class="fas fa-th-large"></i> Go to Dashboard
          </a>
          <span style="font-size:0.8rem;color:#64748b;font-weight:500;padding:0 4px;">
            Hi, ${firstName}
          </span>
          <button id="lp-logout-btn"
            style="background:none;border:1.5px solid #e2e8f0;padding:7px 14px;border-radius:7px;
                   font-size:0.8rem;font-weight:500;color:#64748b;cursor:pointer;font-family:inherit;
                   transition:background 180ms,color 180ms;"
            onmouseover="this.style.background='#f1f5f9';this.style.color='#0f172a';"
            onmouseout="this.style.background='none';this.style.color='#64748b';">
            <i class="fas fa-sign-out-alt"></i> Sign Out
          </button>`;

        document.getElementById('lp-logout-btn')?.addEventListener('click', () => {
          localStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(SESSION_KEY);
          window.location.reload();
        });
      } catch { /* session unreadable — leave default buttons */ }
    }
  }

  /* ── Navbar scroll effect ─────────────────────────────── */
  const nav = document.getElementById('lpNav');
  window.addEventListener('scroll', () => {
    nav?.classList.toggle('lp-nav--scrolled', window.scrollY > 20);
  }, { passive: true });

  /* ── Mobile drawer ────────────────────────────────────── */
  const hamburger   = document.getElementById('lpHamburger');
  const drawer      = document.getElementById('lpDrawer');
  const overlay     = document.getElementById('lpOverlay');
  const drawerClose = document.getElementById('lpDrawerClose');

  function openDrawer() {
    drawer?.classList.add('lp-drawer--open');
    overlay?.classList.add('lp-overlay--visible');
    hamburger?.setAttribute('aria-expanded', 'true');
    drawer?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawer?.classList.remove('lp-drawer--open');
    overlay?.classList.remove('lp-overlay--visible');
    hamburger?.setAttribute('aria-expanded', 'false');
    drawer?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburger?.addEventListener('click', openDrawer);
  drawerClose?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  // Close drawer when a link is clicked
  drawer?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      closeDrawer();
    });
  });

  /* ── Animated stat counters ───────────────────────────── */
  function animateCounters() {
    document.querySelectorAll('.lp-stat__num[data-target]').forEach(el => {
      const target    = parseInt(el.dataset.target, 10);
      const prefix    = el.dataset.prefix || '';
      const suffix    = el.dataset.suffix || '';
      const duration  = 1800;
      const step      = Math.ceil(duration / 60);
      let   current   = 0;
      const increment = Math.max(1, Math.round(target / (duration / step)));

      const timer = setInterval(() => {
        current = Math.min(current + increment, target);
        el.textContent = prefix + current.toLocaleString() + suffix;
        if (current >= target) clearInterval(timer);
      }, step);
    });
  }

  const statsSection = document.getElementById('stats');
  if (statsSection && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { animateCounters(); observer.disconnect(); }
      });
    }, { threshold: 0.3 });
    observer.observe(statsSection);
  } else {
    animateCounters();
  }

  /* ── Smooth scroll for anchor links ──────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id     = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  /* ── Scroll-reveal animations ─────────────────────────── */
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('lp-revealed'); revealObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.lp-feature-card, .lp-step, .lp-stat, .lp-cta-card')
      .forEach(el => { el.classList.add('lp-reveal'); revealObserver.observe(el); });
  }

  /* ── Init ─────────────────────────────────────────────── */
  updateNavState();

})();
