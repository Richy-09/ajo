/**
 * profile.js — Profile Page Logic
 *
 * Handles display, editing, and avatar preview for the user profile page.
 * Satisfies Requirements: 15.1, 15.2, 15.3, 17.1, 18.2, 19.6
 */

import { getUser, updateUser } from './api.js';
import { showToast, showSpinner, hideSpinner } from './utils.js';
import { requireAdmin } from './auth.js';

const USER_ID = '1';
const PAGE_ID = 'profile';

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

  // Init nav (active link + hamburger/overlay wiring)
  initNav(PAGE_ID);

  // Load profile data
  loadProfile();

  // Wire form submit
  const form = document.getElementById('profile-form');
  if (form) form.addEventListener('submit', handleFormSubmit);

  // Wire avatar preview
  const photoInput = document.getElementById('photo');
  if (photoInput) photoInput.addEventListener('change', handleAvatarPreview);
});

// ---------------------------------------------------------------------------
// Load & render profile
// ---------------------------------------------------------------------------

/**
 * Fetches the current user and populates both the display section and the
 * edit form. Uses showSpinner while loading, then calls renderDisplay().
 */
async function loadProfile() {
  const displayEl = document.getElementById('profile-display');
  showSpinner(displayEl);

  try {
    const user = await getUser(USER_ID);
    renderDisplay(user);
    prefillForm(user);
  } catch (err) {
    showToast(err.message, 'error');
    // Restore empty display section so the page remains usable
    hideSpinner(displayEl, buildDisplayHTML({ name: '', phone: '', groupName: '', memberSince: '', photo: '' }));
  }
}

/**
 * Builds the display-section HTML string from a user object.
 *
 * @param {object} user
 * @returns {string}
 */
function buildDisplayHTML(user) {
  return `
    <div class="profile-avatar-wrap">
      <img id="avatar" src="${user.photo || ''}" alt="Avatar" />
      <strong id="display-name" style="font-size:1rem;font-weight:700;color:var(--text);">${user.name || ''}</strong>
    </div>
    <div class="profile-info-row">
      <i class="fas fa-phone"></i>
      <span>Phone</span>
      <strong id="display-phone">${user.phone || '—'}</strong>
    </div>
    <div class="profile-info-row">
      <i class="fas fa-users"></i>
      <span>Group</span>
      <strong id="display-group">${user.groupName || '—'}</strong>
    </div>
    <div class="profile-info-row">
      <i class="fas fa-calendar-alt"></i>
      <span>Since</span>
      <strong id="display-since">${user.memberSince || '—'}</strong>
    </div>
  `;
}

/**
 * Renders the profile display section with the provided user data.
 *
 * @param {object} user
 */
function renderDisplay(user) {
  const displayEl = document.getElementById('profile-display');
  hideSpinner(displayEl, buildDisplayHTML(user));
}

/**
 * Pre-fills the edit form fields with the provided user data.
 * Password is intentionally never pre-filled.
 *
 * @param {object} user
 */
function prefillForm(user) {
  const nameInput = document.getElementById('profile-name');
  const phoneInput = document.getElementById('profile-phone');
  const emailInput = document.getElementById('profile-email');
  const passwordInput = document.getElementById('profile-password');

  if (nameInput) nameInput.value = user.name || '';
  if (phoneInput) phoneInput.value = user.phone || '';
  if (emailInput) emailInput.value = user.email || '';
  if (passwordInput) passwordInput.value = ''; // never pre-fill
}

// ---------------------------------------------------------------------------
// Avatar preview
// ---------------------------------------------------------------------------

/**
 * Reads the selected image file and sets the avatar preview src client-side
 * before any form submission occurs.
 *
 * @param {Event} e - The file input change event.
 */
function handleAvatarPreview(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (readerEvent) => {
    const avatar = document.getElementById('avatar');
    if (avatar) avatar.src = readerEvent.target.result;
  };
  reader.readAsDataURL(file);
}

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

/**
 * Handles the Edit Profile form submission.
 * Validates required fields, optionally reads a photo file as a DataURL,
 * and sends a PUT request via the API layer.
 *
 * @param {Event} e - The form submit event.
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  // Clear previous validation state
  clearValidation();

  // Read form values
  const name = document.getElementById('profile-name')?.value.trim() ?? '';
  const email = document.getElementById('profile-email')?.value.trim() ?? '';
  const phone = document.getElementById('profile-phone')?.value.trim() ?? '';
  const password = document.getElementById('profile-password')?.value ?? '';
  const photoFile = document.getElementById('photo')?.files[0] ?? null;

  // Validate required fields — Requirement 15.3, 17.1
  if (!name) {
    showFieldError('profile-name', 'profile-name-error', 'Name is required.');
    return;
  }
  if (!email) {
    showFieldError('profile-email', 'profile-email-error', 'Email is required.');
    return;
  }

  // Disable submit to prevent duplicate requests — Requirement 18.2
  const submitBtn = document.getElementById('profile-submit');
  if (submitBtn) submitBtn.disabled = true;

  // Build the update payload
  const data = { name, email, phone };
  if (password) data.password = password;

  try {
    if (photoFile) {
      // Read photo as DataURL, then save — keeps everything in one PUT
      const dataUrl = await readFileAsDataURL(photoFile);
      data.photo = dataUrl;
      await updateUser(USER_ID, data);
    } else {
      await updateUser(USER_ID, data);
    }

    // Success — Requirement 19 (success toast), 15.2
    showToast('✓ Profile Updated');
    await loadProfile();
  } catch (err) {
    // Error toast — Requirement 19.6
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Displays an inline validation error for a form field.
 *
 * @param {string} inputId   - The id of the input element.
 * @param {string} errorId   - The id of the error <span>.
 * @param {string} message   - The error message to display.
 */
function showFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (input) input.classList.add('invalid');
  if (errorEl) errorEl.textContent = message;
}

/**
 * Clears all inline validation errors and `.invalid` classes on the form.
 */
function clearValidation() {
  const inputs = document.querySelectorAll('#profile-form .form-control');
  inputs.forEach((el) => el.classList.remove('invalid'));

  const errors = document.querySelectorAll('#profile-form .field-error');
  errors.forEach((el) => (el.textContent = ''));
}

/**
 * Wraps FileReader.readAsDataURL in a Promise for use with async/await.
 *
 * @param {File} file
 * @returns {Promise<string>} The DataURL string.
 */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}
