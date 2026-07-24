/**
 * login.js — Sign In + Register logic
 *
 * Sign In:
 *   1. Check /users (admin) by email + password
 *   2. Check /members (member) by email + password
 *   3. Save session, redirect to correct dashboard
 *
 * Register:
 *   1. Validate all fields
 *   2. Check /members for duplicate email
 *   3. POST to /members with role:'member', status:'Active'
 *   4. Save session, redirect to user-dashboard.html
 */

import { saveSession } from './auth.js';

const BASE_URL = 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────
// Read URL params — show access banner if redirected from a page
// ─────────────────────────────────────────────────────────────

function showAccessBanner() {
  const params   = new URLSearchParams(window.location.search);
  const pageName = params.get('page');

  if (!pageName) return;

  // Pick the right panel to show the banner in
  const isRegister = params.has('register');
  const bannerId   = isRegister ? 'register-alert' : 'login-alert';
  const textId     = isRegister ? 'register-alert-text' : 'login-alert-text';

  const banner = document.getElementById(bannerId);
  const text   = document.getElementById(textId);

  if (!banner || !text) return;

  // Custom notification styling — use success (teal) to differentiate from errors
  banner.className = 'alert info';
  banner.querySelector('i')?.setAttribute('class', 'fas fa-user-shield');
  text.innerHTML = `Create an account or sign in to access <strong>${pageName}</strong>.`;
  banner.style.display = 'flex';
}

// ─────────────────────────────────────────────────────────────
// Switch to register tab if ?register is in URL
// ─────────────────────────────────────────────────────────────

function applyUrlTab() {
  if (window.location.search.includes('register')) {
    switchToPanel('panel-register');
  }
}

// ─────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─────────────────────────────────────────────────────────────
// Alert banners
// ─────────────────────────────────────────────────────────────

function showAlert(id, textId, message, type = 'error') {
  const banner = document.getElementById(id);
  const text   = document.getElementById(textId);
  if (!banner || !text) return;
  banner.className = `alert ${type}`;
  text.textContent = message;
}

function hideAlert(id) {
  const banner = document.getElementById(id);
  if (banner) banner.className = 'alert';
}

// ─────────────────────────────────────────────────────────────
// Field error helpers
// ─────────────────────────────────────────────────────────────

function setError(inputId, errorId, message) {
  document.getElementById(inputId)?.classList.add('invalid');
  const el = document.getElementById(errorId);
  if (el) el.textContent = message;
}

function clearErrors(fields) {
  fields.forEach(({ inputId, errorId }) => {
    document.getElementById(inputId)?.classList.remove('invalid');
    const el = document.getElementById(errorId);
    if (el) el.textContent = '';
  });
}

// ─────────────────────────────────────────────────────────────
// Password strength checker
// ─────────────────────────────────────────────────────────────

const PASSWORD_RULES = [
  { id: 'req-upper',   label: 'Uppercase letter',   test: (p) => /[A-Z]/.test(p)        },
  { id: 'req-lower',   label: 'Lowercase letter',   test: (p) => /[a-z]/.test(p)        },
  { id: 'req-number',  label: 'Number',             test: (p) => /[0-9]/.test(p)        },
  { id: 'req-special', label: 'Special character',  test: (p) => /[^A-Za-z0-9]/.test(p) },
  { id: 'req-length',  label: 'At least 8 chars',  test: (p) => p.length >= 8           },
];

function checkPasswordStrength(password) {
  const results = PASSWORD_RULES.map(rule => ({ ...rule, met: rule.test(password) }));
  const metCount = results.filter(r => r.met).length;

  // Update requirement items
  results.forEach(r => {
    const el = document.getElementById(r.id);
    if (!el) return;
    el.classList.toggle('met',   r.met);
    el.classList.toggle('unmet', password.length > 0 && !r.met);
    if (password.length === 0) el.classList.remove('unmet');
  });

  // Update strength bar
  const fill = document.getElementById('pw-strength-fill');
  const bar  = document.getElementById('pw-strength-bar');
  if (!fill || !bar) return results;

  bar.style.display = password.length > 0 ? 'block' : 'none';

  const pct = (metCount / PASSWORD_RULES.length) * 100;
  const colours = ['#dc2626', '#ea580c', '#d97706', '#65a30d', '#16a34a'];
  const colourIdx = Math.min(metCount - 1, colours.length - 1);
  fill.style.width = `${pct}%`;
  fill.style.background = password.length > 0 ? (colours[colourIdx] || '#e2e8f0') : '#e2e8f0';

  return results;
}

function isPasswordStrong(password) {
  return PASSWORD_RULES.every(rule => rule.test(password));
}

function initPasswordStrengthChecker() {
  const input = document.getElementById('reg-password');
  if (!input) return;
  input.addEventListener('input', () => checkPasswordStrength(input.value));
}

// ─────────────────────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────────────────────

function switchToPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });

  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');

  const tabId = panelId === 'panel-login' ? 'tab-login-btn' : 'tab-register-btn';
  const btn   = document.getElementById(tabId);
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
}

// ─────────────────────────────────────────────────────────────
// Sign In handler
// ─────────────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  hideAlert('login-alert');

  const loginFields = [
    { inputId: 'login-email',    errorId: 'login-email-error' },
    { inputId: 'login-password', errorId: 'login-password-error' },
  ];
  clearErrors(loginFields);

  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  let hasError = false;
  if (!email)    { setError('login-email',    'login-email-error',    'Email is required.');    hasError = true; }
  if (!password) { setError('login-password', 'login-password-error', 'Password is required.'); hasError = true; }
  if (hasError) return;

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';

  try {
    // 1. Check admin (users collection)
    const users = await fetchJson(`${BASE_URL}/users?email=${encodeURIComponent(email)}`);
    const admin = users.find(u => u.password === password);
    if (admin) {
      saveSession({ id: admin.id, name: admin.name, email: admin.email, role: 'admin' });
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next || 'dashboard.html';
      return;
    }

    // 2. Check member
    const members = await fetchJson(`${BASE_URL}/members?email=${encodeURIComponent(email)}`);
    const member  = members.find(m => m.password === password);
    if (member) {
      saveSession({ id: member.id, name: member.name, email: member.email, role: 'member' });
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next || 'user-dashboard.html';
      return;
    }

    showAlert('login-alert', 'login-alert-text', 'Incorrect email or password. Please try again.');

  } catch (err) {
    showAlert('login-alert', 'login-alert-text', 'Could not connect to the server. Make sure JSON Server is running.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
  }
}

// ─────────────────────────────────────────────────────────────
// Register handler
// ─────────────────────────────────────────────────────────────

async function handleRegister(e) {
  e.preventDefault();
  hideAlert('register-alert');

  const regFields = [
    { inputId: 'reg-name',     errorId: 'reg-name-error' },
    { inputId: 'reg-email',    errorId: 'reg-email-error' },
    { inputId: 'reg-phone',    errorId: 'reg-phone-error' },
    { inputId: 'reg-password', errorId: 'reg-password-error' },
    { inputId: 'reg-confirm',  errorId: 'reg-confirm-error' },
    { inputId: 'reg-date',     errorId: 'reg-date-error' },
  ];
  clearErrors(regFields);

  const name     = document.getElementById('reg-name')?.value.trim();
  const email    = document.getElementById('reg-email')?.value.trim();
  const phone    = document.getElementById('reg-phone')?.value.trim();
  const password = document.getElementById('reg-password')?.value;
  const confirm  = document.getElementById('reg-confirm')?.value;
  const date     = document.getElementById('reg-date')?.value;

  let hasError = false;

  if (!name) {
    setError('reg-name', 'reg-name-error', 'Full name is required.');
    hasError = true;
  }
  if (!email) {
    setError('reg-email', 'reg-email-error', 'Email is required.');
    hasError = true;
  }
  if (!phone || !/^\d{10,15}$/.test(phone)) {
    setError('reg-phone', 'reg-phone-error', 'Enter a valid phone number (10–15 digits).');
    hasError = true;
  }
  if (!password || !isPasswordStrong(password)) {
    // Show which rules are failing
    const results = checkPasswordStrength(password || '');
    const failing = results.filter(r => !r.met).map(r => r.label);
    const msg = failing.length
      ? `Password missing: ${failing.join(', ')}.`
      : 'Password must meet all requirements.';
    setError('reg-password', 'reg-password-error', msg);
    // Show the strength bar so they can see what's needed
    const bar = document.getElementById('pw-strength-bar');
    if (bar) bar.style.display = 'block';
    hasError = true;
  }
  if (password !== confirm) {
    setError('reg-confirm', 'reg-confirm-error', 'Passwords do not match.');
    hasError = true;
  }
  if (!date) {
    setError('reg-date', 'reg-date-error', 'Please select a joining date.');
    hasError = true;
  }
  if (hasError) return;

  const btn = document.getElementById('register-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account…';

  try {
    // Check for duplicate email
    const existing = await fetchJson(`${BASE_URL}/members?email=${encodeURIComponent(email)}`);
    if (existing.length > 0) {
      setError('reg-email', 'reg-email-error', 'An account with this email already exists.');
      return;
    }

    // Create the new member
    const newMember = {
      name,
      email,
      phone,
      password,
      role: 'member',
      status: 'Active',
      dateJoined: date,
      contributionAmount: 0,
    };

    const created = await postJson(`${BASE_URL}/members`, newMember);
    saveSession({ id: created.id, name: created.name, email: created.email, role: 'member' });
    showToast('✓ Account created! Redirecting…');

    setTimeout(() => {
      window.location.href = 'user-dashboard.html';
    }, 1200);

  } catch (err) {
    showAlert('register-alert', 'register-alert-text', `Registration failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
  }
}

// ─────────────────────────────────────────────────────────────
// Password visibility toggles
// ─────────────────────────────────────────────────────────────

function initPasswordToggles() {
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input    = document.getElementById(targetId);
      const icon     = btn.querySelector('i');
      if (!input || !icon) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();
  initPasswordStrengthChecker();

  // Tab buttons
  document.getElementById('tab-login-btn')?.addEventListener('click', () => switchToPanel('panel-login'));
  document.getElementById('tab-register-btn')?.addEventListener('click', () => switchToPanel('panel-register'));

  // Switch links inside panels
  document.getElementById('go-register')?.addEventListener('click', () => switchToPanel('panel-register'));
  document.getElementById('go-login')?.addEventListener('click', () => {
    switchToPanel('panel-login');
    // Hide strength bar when going back to login
    const bar = document.getElementById('pw-strength-bar');
    if (bar) bar.style.display = 'none';
  });

  // Forms
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('register-form')?.addEventListener('submit', handleRegister);

  // Apply URL tab + show access banner
  applyUrlTab();
  showAccessBanner();
});
