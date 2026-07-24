/**
 * contributions.js — Contributions page logic
 *
 * Handles: member dropdown population, record/edit/delete contributions,
 * search (keyup), sort (change), XSS-safe table rendering, toast feedback,
 * and activity logging.
 *
 * Validates Requirements: 11.1–11.5, 12.1, 12.2, 17.1, 17.3,
 *                         18.2, 19.2, 19.4, 19.6, 20.1, 20.2
 */

import {
  getMembers,
  getContributions,
  addContribution,
  updateContribution,
  deleteContribution,
} from './api.js';
import {
  showToast,
  showSpinner,
  hideSpinner,
  formatCurrency,
  logActivity,
} from './utils.js';
import { requireAdmin } from './auth.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const PAGE_ID = 'contributions';

/** @type {Array<{id:string, memberId:string, memberName:string, amount:number, date:string}>} */
let allContributions = [];

/** @type {Array<{id:string, name:string}>} */
let allMembers = [];

/** @type {typeof allContributions} */
let filteredContributions = [];

/** ID of the contribution currently being edited, or null when adding. */
let editingId = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escapes HTML special characters to prevent XSS when injecting user data
 * into innerHTML.
 *
 * @param {string|number} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Clears all inline field-error spans in the contribution form.
 */
function clearErrors() {
  ['contribution-member-error', 'contribution-amount-error', 'contribution-date-error'].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    }
  );
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Fetches members and contributions in parallel, populates the member
 * dropdown, stores data in module state, and renders the table.
 */
async function loadData() {
  const tbody = document.getElementById('contributions-tbody');
  showSpinner(tbody);

  try {
    const [members, contributions] = await Promise.all([
      getMembers(),
      getContributions(),
    ]);

    allMembers = members;
    allContributions = contributions;
    filteredContributions = [...contributions];

    // Populate member dropdown (preserve existing placeholder option)
    const select = document.getElementById('contribution-member');
    // Remove any previously injected options (keep the placeholder at index 0)
    while (select.options.length > 1) {
      select.remove(1);
    }
    allMembers.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.dataset.name = m.name;
      opt.textContent = m.name;
      select.appendChild(opt);
    });

    renderTable();
  } catch (err) {
    showToast(`Error loading data: ${err.message}`, 'error');
    // Restore empty tbody so the page is still usable
    if (tbody) tbody.innerHTML = '';
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Applies the current search query and sort selection to `allContributions`,
 * stores the result in `filteredContributions`, and returns it.
 *
 * @returns {typeof allContributions}
 */
function applySortAndFilter() {
  const query = (document.getElementById('contribution-search')?.value ?? '').toLowerCase().trim();
  const sortVal = document.getElementById('contribution-sort')?.value ?? 'newest';

  // 1. Filter
  let result = allContributions.filter((c) => {
    if (!query) return true;
    return (
      c.memberName.toLowerCase().includes(query) ||
      String(c.amount).includes(query) ||
      c.date.includes(query)
    );
  });

  // 2. Sort
  result = [...result].sort((a, b) => {
    switch (sortVal) {
      case 'newest':
        return new Date(b.date) - new Date(a.date);
      case 'oldest':
        return new Date(a.date) - new Date(b.date);
      case 'amount-high':
        return b.amount - a.amount;
      case 'amount-low':
        return a.amount - b.amount;
      case 'name-az':
        return a.memberName.localeCompare(b.memberName);
      case 'name-za':
        return b.memberName.localeCompare(a.memberName);
      default:
        return 0;
    }
  });

  filteredContributions = result;
  return result;
}

/**
 * Rebuilds the contributions table body using the currently filtered/sorted
 * data.
 */
function renderTable() {
  const tbody = document.getElementById('contributions-tbody');
  if (!tbody) return;

  const rows = applySortAndFilter();

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;padding:1.5rem;color:var(--text);">
          No contributions found.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (c) => `
    <tr>
      <td>${escapeHtml(c.memberName)}</td>
      <td>${escapeHtml(formatCurrency(c.amount))}</td>
      <td>${escapeHtml(c.date)}</td>
      <td>
        <button
          class="btn btn-primary btn-sm"
          aria-label="Edit contribution for ${escapeHtml(c.memberName)}"
          onclick="window.__editContribution('${escapeHtml(c.id)}')"
        ><i class="fas fa-edit"></i> Edit</button>
        <button
          class="btn btn-danger btn-sm"
          aria-label="Delete contribution for ${escapeHtml(c.memberName)}"
          onclick="window.__deleteContribution('${escapeHtml(c.id)}', '${escapeHtml(c.memberName)}')"
        ><i class="fas fa-trash"></i> Delete</button>
      </td>
    </tr>`
    )
    .join('');
}

// ---------------------------------------------------------------------------
// Form handling
// ---------------------------------------------------------------------------

/**
 * Validates the contribution form fields and returns the field values when
 * valid, or null when there are errors.
 *
 * @returns {{memberId:string, memberName:string, amount:string, date:string}|null}
 */
function validateForm() {
  clearErrors();

  const memberSelect = document.getElementById('contribution-member');
  const amountInput = document.getElementById('contribution-amount');
  const dateInput = document.getElementById('contribution-date');

  const memberId = memberSelect?.value ?? '';
  const selectedOption = memberSelect?.options[memberSelect.selectedIndex];
  const memberName = selectedOption?.dataset?.name ?? '';
  const amount = amountInput?.value ?? '';
  const date = dateInput?.value ?? '';

  let valid = true;

  if (!memberId) {
    const err = document.getElementById('contribution-member-error');
    if (err) err.textContent = 'Please select a member.';
    valid = false;
  }

  if (!amount || Number(amount) <= 0) {
    const err = document.getElementById('contribution-amount-error');
    if (err) err.textContent = 'Amount must be greater than 0.';
    valid = false;
  }

  if (!date) {
    const err = document.getElementById('contribution-date-error');
    if (err) err.textContent = 'Please select a date.';
    valid = false;
  }

  if (!valid) return null;
  return { memberId, memberName, amount, date };
}

/**
 * Handles the contribution form submit event.
 *
 * @param {SubmitEvent} e
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const fields = validateForm();
  if (!fields) return;

  const { memberId, memberName, amount, date } = fields;
  const submitBtn = document.getElementById('contribution-submit');

  // Disable button to prevent duplicate submissions (Requirement 18.2)
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (editingId) {
      // Update existing contribution (Requirement 11.4)
      await updateContribution(editingId, {
        memberId,
        memberName,
        amount: Number(amount),
        date,
      });
      showToast('✓ Contribution Updated');
      logActivity('updated', 'contribution', `Contribution updated for ${memberName}`, memberId, memberName);
    } else {
      // Add new contribution (Requirement 11.2)
      await addContribution({ memberId, memberName, amount: Number(amount), date });
      showToast('✓ Contribution Recorded');
      logActivity('created', 'contribution', `${memberName} contributed ${formatCurrency(Number(amount))}`, memberId, memberName);
    }

    // Reset state
    resetForm();
    await loadData();
  } catch (err) {
    // Requirement 19.6 — API error toast
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/**
 * Resets the contribution form to its default "add" state.
 */
function resetForm() {
  const form = document.getElementById('contribution-form');
  if (form) form.reset();
  editingId = null;
  clearErrors();

  const submitBtn = document.getElementById('contribution-submit');
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Record Contribution';
  }
}

// ---------------------------------------------------------------------------
// Edit / Delete (exposed on window for inline onclick handlers)
// ---------------------------------------------------------------------------

/**
 * Pre-fills the form for editing an existing contribution.
 *
 * @param {string} id
 */
function editContribution(id) {
  const contribution = allContributions.find((c) => c.id === id);
  if (!contribution) return;

  editingId = id;

  const memberSelect = document.getElementById('contribution-member');
  if (memberSelect) memberSelect.value = contribution.memberId;

  const amountInput = document.getElementById('contribution-amount');
  if (amountInput) amountInput.value = contribution.amount;

  const dateInput = document.getElementById('contribution-date');
  if (dateInput) dateInput.value = contribution.date;

  const submitBtn = document.getElementById('contribution-submit');
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Contribution';
  }

  clearErrors();

  // Scroll to the form panel so the user can see the pre-filled fields
  document.getElementById('contribution-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Confirms and deletes a contribution by id.
 *
 * @param {string} id
 * @param {string} memberName
 */
async function deleteContributionEntry(id, memberName) {
  if (!confirm(`Delete this contribution for ${memberName}?`)) return;

  try {
    await deleteContribution(id);
    showToast('✓ Deleted Successfully');
    logActivity('deleted', 'contribution', `Contribution deleted for ${memberName}`, id, memberName);
    await loadData();
  } catch (err) {
    // Requirement 19.6
    showToast(`Error: ${err.message}`, 'error');
  }
}

// Expose handlers on window so inline onclick attributes in the table can
// reach them across the ES module boundary.
window.__editContribution = editContribution;
window.__deleteContribution = deleteContributionEntry;

// ---------------------------------------------------------------------------
// Boot
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

  // Requirement 2.5 — highlight active nav link + hamburger/overlay wiring
  initNav(PAGE_ID);

  // Load data (populates dropdown + table)
  loadData();

  // Form submit (Requirement 11.2, 11.4, 17.1, 17.3)
  const form = document.getElementById('contribution-form');
  if (form) form.addEventListener('submit', handleFormSubmit);

  // Search (Requirement 12.1, 20.1)
  const searchInput = document.getElementById('contribution-search');
  if (searchInput) searchInput.addEventListener('keyup', renderTable);

  // Sort (Requirement 12.2, 20.2)
  const sortSelect = document.getElementById('contribution-sort');
  if (sortSelect) sortSelect.addEventListener('change', renderTable);
});
