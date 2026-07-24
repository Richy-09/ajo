/**
 * members.js — Members page logic for Ajo Savings Tracker
 *
 * Handles: CRUD operations, search/filter, pagination, form validation,
 * and activity logging for the members.html page.
 *
 * Requirements: 9.1–9.5, 10.1–10.3, 17.1, 17.2, 17.4, 18.2, 19.1, 19.4, 19.6
 */

import { getMembers, addMember, updateMember, deleteMember } from './api.js';
import {
  showToast,
  showSpinner,
  hideSpinner,
  formatCurrency,
  logActivity,
} from './utils.js';
import { requireAdmin } from './auth.js';

// ---------------------------------------------------------------------------
// Constants & State
// ---------------------------------------------------------------------------

const PAGE_ID = 'members';
const PAGE_SIZE = 4;

/** @type {Array<object>} Full list fetched from API */
let allMembers = [];

/** @type {Array<object>} Subset after applying the current search query */
let filteredMembers = [];

/** @type {number} Current pagination page (1-based) */
let currentPage = 1;

/** @type {string|null} ID of the member currently being edited, or null when adding */
let editingId = null;

// ---------------------------------------------------------------------------
// DOM references (resolved after DOMContentLoaded)
// ---------------------------------------------------------------------------

let tbody;
let submitBtn;
let prevBtn;
let nextBtn;
let pageRangeEl;
let searchInput;
let memberForm;

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

  // 2. Resolve DOM references
  tbody = document.getElementById('members-tbody');
  submitBtn = document.getElementById('member-submit');
  prevBtn = document.getElementById('prev-btn');
  nextBtn = document.getElementById('next-btn');
  pageRangeEl = document.getElementById('page-range');
  searchInput = document.getElementById('member-search');
  memberForm = document.getElementById('member-form');

  // 4. Load members from API
  loadMembers();

  // 5. Wire form submit
  if (memberForm) {
    memberForm.addEventListener('submit', handleFormSubmit);
  }

  // 6. Wire search
  if (searchInput) {
    searchInput.addEventListener('keyup', handleSearch);
  }

  // 7. Wire pagination buttons
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(filteredMembers.length / PAGE_SIZE);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Fetches all members from the API, stores them in state, and renders the table.
 * Shows a spinner while loading and an error toast on failure.
 */
async function loadMembers() {
  showSpinner(tbody);
  try {
    allMembers = await getMembers();
    filteredMembers = [...allMembers];
    renderTable();
  } catch (err) {
    showToast(`Failed to load members: ${err.message}`, 'error');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5">Failed to load members.</td></tr>';
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Renders the current page of filteredMembers into #members-tbody,
 * updates the pagination range label, and toggles Prev/Next button states.
 */
function renderTable() {
  if (!tbody) return;

  const total = filteredMembers.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  // Clamp currentPage in case filtered results shrank
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  const pageItems = filteredMembers.slice(start, end);

  // Update page-range label  e.g. "1–4 of 8"
  if (pageRangeEl) {
    if (total === 0) {
      pageRangeEl.textContent = '0 of 0';
    } else {
      pageRangeEl.textContent = `${start + 1}–${end} of ${total}`;
    }
  }

  // Enable / disable pagination buttons
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  // Build rows
  if (total === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:24px;">No members found.</td></tr>';
    return;
  }

  tbody.innerHTML = pageItems.map((member) => buildRow(member)).join('');

  // Wire per-row action buttons
  pageItems.forEach((member) => {
    const editBtn = tbody.querySelector(`[data-edit-id="${member.id}"]`);
    const delBtn = tbody.querySelector(`[data-delete-id="${member.id}"]`);

    if (editBtn) editBtn.addEventListener('click', () => handleEdit(member));
    if (delBtn) delBtn.addEventListener('click', () => handleDelete(member.id, member.name));
  });
}

/**
 * Builds a table row HTML string for a single member.
 *
 * @param {object} member
 * @returns {string}
 */
function buildRow(member) {
  const badgeClass = member.status === 'Active' ? 'badge-success' : 'badge-danger';
  const amount = member.contributionAmount != null
    ? formatCurrency(member.contributionAmount)
    : '—';

  return `
    <tr data-id="${member.id}">
      <td>${escapeHtml(member.name)}</td>
      <td>${escapeHtml(member.phone)}</td>
      <td>${amount}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(member.status)}</span></td>
      <td>
        <button
          class="btn btn-primary"
          style="padding:4px 10px;font-size:0.8rem;margin-right:4px;"
          data-edit-id="${member.id}"
          aria-label="Edit ${escapeHtml(member.name)}"
        >
          <i class="fas fa-edit"></i> Edit
        </button>
        <button
          class="btn btn-danger"
          style="padding:4px 10px;font-size:0.8rem;"
          data-delete-id="${member.id}"
          aria-label="Delete ${escapeHtml(member.name)}"
        >
          <i class="fas fa-trash"></i> Delete
        </button>
      </td>
    </tr>
  `;
}

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

/**
 * Handles the Add / Update member form submission.
 * Validates input, prevents duplicates, calls the API, then reloads the table.
 *
 * @param {SubmitEvent} e
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const nameEl = document.getElementById('name');
  const phoneEl = document.getElementById('phone');
  const emailEl = document.getElementById('email');
  const statusEl = document.getElementById('status');
  const dateJoinedEl = document.getElementById('date-joined');

  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  const email = emailEl.value.trim();
  const status = statusEl.value;
  const dateJoined = dateJoinedEl.value;

  // --- Clear previous errors ---
  clearErrors();

  let hasError = false;

  // Name: required
  if (!name) {
    setError(nameEl, 'name-error', 'Name is required.');
    hasError = true;
  }

  // Phone: required + 10–15 digits
  if (!phone) {
    setError(phoneEl, 'phone-error', 'Phone is required.');
    hasError = true;
  } else if (!/^\d{10,15}$/.test(phone)) {
    setError(phoneEl, 'phone-error', 'Phone must be 10–15 digits.');
    hasError = true;
  }

  // Email: required
  if (!email) {
    setError(emailEl, 'email-error', 'Email is required.');
    hasError = true;
  }

  // Status: required
  if (!status) {
    setError(statusEl, 'status-error', 'Status is required.');
    hasError = true;
  }

  // Date Joined: required
  if (!dateJoined) {
    setError(dateJoinedEl, 'date-joined-error', 'Date joined is required.');
    hasError = true;
  }

  // Duplicate check (add mode only)
  if (!editingId && name && phone && /^\d{10,15}$/.test(phone)) {
    const duplicate = allMembers.find(
      (m) => m.name.toLowerCase() === name.toLowerCase() && m.phone === phone
    );
    if (duplicate) {
      setError(nameEl, 'name-error', 'A member with this name and phone already exists.');
      hasError = true;
    }
  }

  if (hasError) return;

  // --- Build payload ---
  const data = { name, phone, email, status, dateJoined };

  // Preserve contributionAmount if editing
  if (editingId) {
    const existing = allMembers.find((m) => m.id === editingId);
    if (existing && existing.contributionAmount != null) {
      data.contributionAmount = existing.contributionAmount;
    }
  }

  // --- Disable submit to prevent double-submission ---
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (editingId) {
      await updateMember(editingId, data);
      showToast('✓ Member Updated');
      logActivity('updated', 'member', `Member ${name} updated`);
    } else {
      await addMember(data);
      showToast('✓ Member Added');
      logActivity('created', 'member', `New member ${name} added`);
    }

    // Reset state and form
    resetForm();
    await loadMembers();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Edit handler
// ---------------------------------------------------------------------------

/**
 * Pre-fills the form with a member's data for editing.
 *
 * @param {object} member
 */
function handleEdit(member) {
  document.getElementById('name').value = member.name || '';
  document.getElementById('phone').value = member.phone || '';
  document.getElementById('email').value = member.email || '';
  document.getElementById('status').value = member.status || '';
  document.getElementById('date-joined').value = member.dateJoined || '';

  editingId = member.id;

  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Member';
  }

  // Scroll form into view
  const formPanel = document.querySelector('.form-panel');
  if (formPanel) formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Delete handler — custom modal
// ---------------------------------------------------------------------------

/**
 * Opens the custom delete confirmation modal.
 * Resolves a promise with true (confirm) or false (cancel).
 *
 * @param {string} name - Member name to show in the dialog.
 * @returns {Promise<boolean>}
 */
function openDeleteModal(name) {
  return new Promise((resolve) => {
    const modal     = document.getElementById('delete-modal');
    const msg       = document.getElementById('delete-modal-msg');
    const btnCancel = document.getElementById('delete-modal-cancel');
    const btnConfirm= document.getElementById('delete-modal-confirm');
    const backdrop  = document.getElementById('delete-modal-backdrop');
    if (!modal) { resolve(false); return; }

    msg.textContent = `You are about to remove "${name}" from the group. This action cannot be undone.`;
    modal.style.display = 'flex';

    function cleanup() {
      modal.style.display = 'none';
      btnCancel.removeEventListener('click', onCancel);
      btnConfirm.removeEventListener('click', onConfirm);
      backdrop.removeEventListener('click', onCancel);
    }

    function onCancel()  { cleanup(); resolve(false); }
    function onConfirm() { cleanup(); resolve(true); }

    btnCancel.addEventListener('click', onCancel);
    btnConfirm.addEventListener('click', onConfirm);
    backdrop.addEventListener('click', onCancel);
  });
}

/**
 * Confirms and deletes a member by ID using the custom modal.
 *
 * @param {string} id
 * @param {string} name
 */
async function handleDelete(id, name) {
  const confirmed = await openDeleteModal(name);
  if (!confirmed) return;

  try {
    await deleteMember(id);
    showToast('✓ Member removed successfully');
    logActivity('deleted', 'member', `Member ${name} removed`);
    await loadMembers();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Filters allMembers by the current search query (name or phone),
 * resets to page 1, and re-renders the table.
 */
function handleSearch() {
  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    filteredMembers = [...allMembers];
  } else {
    filteredMembers = allMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.phone.includes(query)
    );
  }

  currentPage = 1;
  renderTable();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Marks a field as invalid and displays an error message.
 *
 * @param {HTMLElement} fieldEl  - The input/select element to mark invalid.
 * @param {string}      errorId  - The ID of the associated <span class="field-error">.
 * @param {string}      message  - The error text to display.
 */
function setError(fieldEl, errorId, message) {
  if (fieldEl) fieldEl.classList.add('invalid');
  const errorEl = document.getElementById(errorId);
  if (errorEl) errorEl.textContent = message;
}

/**
 * Clears all validation error states from the form.
 */
function clearErrors() {
  ['name', 'phone', 'email', 'status', 'date-joined'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('invalid');
  });

  ['name-error', 'phone-error', 'email-error', 'status-error', 'date-joined-error'].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    }
  );
}

/**
 * Resets the form to its add-member default state.
 */
function resetForm() {
  if (memberForm) memberForm.reset();
  clearErrors();
  editingId = null;
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Member';
  }
}

/**
 * Escapes HTML special characters to prevent XSS in table content.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
