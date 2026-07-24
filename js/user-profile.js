import { requireMember, logout, saveSession, getSession } from './auth.js';
import { showToast, showSpinner, hideSpinner } from './utils.js';

const PAGE_ID = 'user-profile';
const BASE_URL = 'http://localhost:3000';

function initNav() {
  document.querySelector(`a[data-page="${PAGE_ID}"]`)?.classList.add('active');
  const hamburger = document.getElementById('hamburger');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');
  const open  = () => { sidebar?.classList.add('open');    overlay?.classList.add('visible'); };
  const close = () => { sidebar?.classList.remove('open'); overlay?.classList.remove('visible'); };
  hamburger?.addEventListener('click', () => sidebar?.classList.contains('open') ? close() : open());
  overlay?.addEventListener('click', close);
  sidebar?.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.getElementById('user-logout-btn')?.addEventListener('click', logout);
}

async function fetchMember(id) {
  const res = await fetch(`${BASE_URL}/members/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function updateMember(id, data) {
  const res = await fetch(`${BASE_URL}/members/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function buildDisplayHTML(m) {
  return `
    <div class="profile-avatar-wrap">
      <img id="avatar" src="" alt="Avatar"
        style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--primary-faint);background:var(--bg);" />
      <strong id="display-name" style="font-size:1rem;font-weight:700;color:var(--text);margin-top:8px;">${m.name || ''}</strong>
    </div>
    <div class="profile-info-row">
      <i class="fas fa-phone"></i>
      <span>Phone</span>
      <strong id="display-phone">${m.phone || '—'}</strong>
    </div>
    <div class="profile-info-row">
      <i class="fas fa-envelope"></i>
      <span>Email</span>
      <strong id="display-email">${m.email || '—'}</strong>
    </div>
    <div class="profile-info-row">
      <i class="fas fa-calendar-alt"></i>
      <span>Joined</span>
      <strong id="display-joined">${m.dateJoined || '—'}</strong>
    </div>
    <div class="profile-info-row">
      <i class="fas fa-circle" style="color:var(--success);font-size:0.5rem;"></i>
      <span>Status</span>
      <strong id="display-status">${m.status || '—'}</strong>
    </div>
  `;
}

async function loadProfile(currentUser) {
  const displayEl = document.getElementById('user-profile-display');
  showSpinner(displayEl);
  try {
    const member = await fetchMember(currentUser.id);
    hideSpinner(displayEl, buildDisplayHTML(member));

    // Pre-fill form
    document.getElementById('up-name').value  = member.name  || '';
    document.getElementById('up-phone').value = member.phone || '';
    document.getElementById('up-email').value = member.email || '';
    document.getElementById('up-password').value = '';
  } catch (err) {
    showToast(`Could not load profile: ${err.message}`, 'error');
    hideSpinner(displayEl, buildDisplayHTML({}));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = requireMember();
  if (!currentUser) return;

  initNav();
  await loadProfile(currentUser);

  const form = document.getElementById('user-profile-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear errors
    ['up-name', 'up-email'].forEach(id => document.getElementById(id)?.classList.remove('invalid'));
    ['up-name-error', 'up-email-error'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });

    const name     = document.getElementById('up-name')?.value.trim();
    const email    = document.getElementById('up-email')?.value.trim();
    const phone    = document.getElementById('up-phone')?.value.trim();
    const password = document.getElementById('up-password')?.value;

    let hasError = false;
    if (!name) {
      document.getElementById('up-name')?.classList.add('invalid');
      const el = document.getElementById('up-name-error');
      if (el) el.textContent = 'Name is required.';
      hasError = true;
    }
    if (!email) {
      document.getElementById('up-email')?.classList.add('invalid');
      const el = document.getElementById('up-email-error');
      if (el) el.textContent = 'Email is required.';
      hasError = true;
    }
    if (hasError) return;

    const submitBtn = document.getElementById('up-submit');
    if (submitBtn) submitBtn.disabled = true;

    try {
      // Get current member to merge unchanged fields
      const existing = await fetchMember(currentUser.id);
      const updated  = { ...existing, name, email, phone };
      if (password) updated.password = password;

      await updateMember(currentUser.id, updated);

      // Refresh session name if changed
      const session = getSession();
      if (session) saveSession({ ...session, name, email });

      showToast('✓ Profile Updated');
      await loadProfile(currentUser);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
