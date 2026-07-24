/**
 * utils.js — Shared UI utilities for Ajo Savings Tracker
 * Provides: showToast, showSpinner, hideSpinner, formatCurrency, logActivity, getActivities
 */

const ACTIVITY_STORAGE_KEY = 'ajo_activities';
const ACTIVITY_MAX_ENTRIES = 20;
const TOAST_DURATION_MS = 3000;

/**
 * Appends a toast notification to the #toast-container element.
 * Auto-dismisses after 3 seconds.
 *
 * @param {string} message - The message to display in the toast.
 * @param {'success'|'error'} type - The visual style of the toast.
 */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, TOAST_DURATION_MS);
}

/**
 * Replaces the innerHTML of a container with a loading spinner.
 *
 * @param {HTMLElement} container - The element to replace with a spinner.
 */
export function showSpinner(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="spinner-wrapper">
      <div class="spinner"></div>
    </div>
  `;
}

/**
 * Restores the innerHTML of a container with the provided HTML.
 *
 * @param {HTMLElement} container - The element to restore.
 * @param {string} html - The HTML string to inject into the container.
 */
export function hideSpinner(container, html) {
  if (!container) return;
  container.innerHTML = html;
}

/**
 * Formats a number as a Naira currency string, e.g. ₦1,234,567.
 *
 * @param {number} amount - The numeric amount to format.
 * @returns {string} The formatted currency string.
 */
export function formatCurrency(amount) {
  const formatted = Number(amount).toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `₦${formatted}`;
}

/**
 * Logs an activity entry to the API (/activities) AND sessionStorage.
 * Keeps only the most recent 20 entries in sessionStorage as a fallback.
 *
 * @param {'created'|'updated'|'deleted'} type - The action type.
 * @param {'member'|'contribution'|'payment'} resource - The affected resource.
 * @param {string} description - A human-readable description of the activity.
 * @param {string} [memberId] - Optional member ID (for filtering on user dashboard).
 * @param {string} [memberName] - Optional member name.
 */
export function logActivity(type, resource, description, memberId = null, memberName = null) {
  const entry = {
    type,
    resource,
    description,
    memberId:   memberId   ? String(memberId)   : null,
    memberName: memberName ? String(memberName) : null,
    timestamp:  new Date().toISOString(),
  };

  // Write to API (fire-and-forget — don't block the UI)
  fetch('http://localhost:3000/activities', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(entry),
  }).catch(() => { /* non-fatal — sessionStorage fallback below */ });

  // Also keep in sessionStorage as a same-session cache
  try {
    const raw        = sessionStorage.getItem('ajo_activities');
    const activities = raw ? JSON.parse(raw) : [];
    activities.unshift(entry);
    sessionStorage.setItem('ajo_activities', JSON.stringify(activities.slice(0, 20)));
  } catch { /* ignore */ }
}

/**
 * Retrieves activity entries from sessionStorage (same-session cache).
 * The dashboards now fetch directly from the API for persistent history.
 *
 * @returns {Array<object>}
 */
export function getActivities() {
  try {
    const raw = sessionStorage.getItem('ajo_activities');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
