/**
 * settings.js — Settings Page Logic
 *
 * Handles:
 *  - Group information display
 *  - Notification toggle persistence via localStorage
 *  - Change password form with validation
 *  - Backup data download via Blob URL
 *  - Logout (clear storage, navigate to index.html)
 */

import { getMembers, getContributions, getPayments, getUser, updateUser } from './api.js';
import { showToast } from './utils.js';
import { requireAdmin, logout } from './auth.js';

const USER_ID = '1';
const PAGE_ID = 'settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clear all inline field errors on the password form. */
function clearPasswordErrors() {
  document.getElementById('current-password-error').textContent = '';
  document.getElementById('new-password-error').textContent = '';
  document.getElementById('confirm-password-error').textContent = '';
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Navigation init
// ---------------------------------------------------------------------------

function initNav(pageId) {
  // Active link
  const activeLink = document.querySelector(`a[data-page="${pageId}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Hamburger + overlay
  const hamburger = document.getElementById('hamburger');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');

  function openSidebar()  { sidebar?.classList.add('open'); overlay?.classList.add('visible'); }
  function closeSidebar() { sidebar?.classList.remove('open'); overlay?.classList.remove('visible'); }

  hamburger?.addEventListener('click', () => {
    sidebar?.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  overlay?.addEventListener('click', closeSidebar);

  // Close sidebar when a nav link is clicked on mobile
  sidebar?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeSidebar));
}

document.addEventListener('DOMContentLoaded', () => {
  // Guard — redirect to login if not admin
  if (!requireAdmin()) return;

  // 1. Init nav (active link + hamburger/overlay wiring)
  initNav(PAGE_ID);

  // 2. Load and display group information
  getUser(USER_ID)
    .then((user) => {
      const nameEl = document.getElementById('group-name-display');
      const dateEl = document.getElementById('group-created-display');
      if (nameEl) nameEl.textContent = `Group: ${user.groupName}`;
      if (dateEl) dateEl.textContent = `Member since: ${user.memberSince}`;
    })
    .catch(() => {
      // Silently fail — group info is display-only, page remains usable
    });

  // 4. Notification toggles — load saved state from localStorage
  const notifyContributions = document.getElementById('notify-contributions');
  const notifyPayments = document.getElementById('notify-payments');

  if (notifyContributions) {
    notifyContributions.checked =
      localStorage.getItem('notify-contributions') === 'true';
    notifyContributions.addEventListener('change', (e) => {
      localStorage.setItem('notify-contributions', e.target.checked);
    });
  }

  if (notifyPayments) {
    notifyPayments.checked =
      localStorage.getItem('notify-payments') === 'true';
    notifyPayments.addEventListener('change', (e) => {
      localStorage.setItem('notify-payments', e.target.checked);
    });
  }

  // 5. Change Password form
  const passwordForm = document.getElementById('password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordSubmit);
  }

  // 6. Backup Data button
  const backupBtn = document.getElementById('backup-btn');
  if (backupBtn) {
    backupBtn.addEventListener('click', handleBackup);
  }

  // 7. Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

// ---------------------------------------------------------------------------
// Change Password Handler
// ---------------------------------------------------------------------------

async function handlePasswordSubmit(e) {
  e.preventDefault();
  clearPasswordErrors();

  const currentPassword = document.getElementById('current-password').value.trim();
  const newPassword = document.getElementById('new-password').value.trim();
  const confirmPassword = document.getElementById('confirm-password').value.trim();

  // Client-side validation
  let hasErrors = false;

  if (!currentPassword) {
    document.getElementById('current-password-error').textContent =
      'Current password is required.';
    hasErrors = true;
  }

  if (!newPassword) {
    document.getElementById('new-password-error').textContent =
      'New password is required.';
    hasErrors = true;
  }

  if (confirmPassword !== newPassword) {
    document.getElementById('confirm-password-error').textContent =
      'Passwords do not match.';
    hasErrors = true;
  }

  if (hasErrors) return;

  const submitBtn = document.getElementById('password-submit');
  submitBtn.disabled = true;

  try {
    const user = await getUser(USER_ID);

    // Verify current password against stored value
    if (currentPassword !== user.password) {
      document.getElementById('current-password-error').textContent =
        'Current password is incorrect.';
      return;
    }

    // Update password
    await updateUser(USER_ID, { ...user, password: newPassword });
    showToast('✓ Password Updated');
    document.getElementById('password-form').reset();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Backup Data Handler
// ---------------------------------------------------------------------------

async function handleBackup() {
  try {
    const [members, contributions, payments] = await Promise.all([
      getMembers(),
      getContributions(),
      getPayments(),
    ]);

    const backupData = JSON.stringify({ members, contributions, payments }, null, 2);
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ajo-backup.json';
    anchor.click();

    URL.revokeObjectURL(url);
    showToast('✓ Backup downloaded');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Logout Handler
// ---------------------------------------------------------------------------

function handleLogout() {
  logout();
}
