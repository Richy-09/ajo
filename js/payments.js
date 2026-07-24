/**
 * payments.js — Payments page logic
 *
 * Handles CRUD operations for the Payments resource, including:
 * - Loading and displaying payments in a table with status badges
 * - Adding and editing payments via a form
 * - Deleting payments with confirmation
 * - Searching and sorting the payments table
 *
 * Requirements: 13.1–13.5, 17.1, 17.3, 18.2, 19.3, 19.4, 19.6, 20.1, 20.2
 */

import { getMembers, getPayments, getContributions, addPayment, updatePayment, deletePayment, getPaymentRequests, updatePaymentRequest } from './api.js';
import { showToast, showSpinner, hideSpinner, formatCurrency, logActivity } from './utils.js';
import { requireAdmin } from './auth.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const PAGE_ID = 'payments';

/** @type {Array<object>} All payments fetched from the API */
let allPayments = [];

/** @type {Array<object>} All members fetched from the API */
let allMembers = [];

/** @type {Array<object>} Currently visible (filtered + sorted) payments */
let filteredPayments = [];

/** @type {string|null} ID of the payment currently being edited, or null for add mode */
let editingId = null;

// ---------------------------------------------------------------------------
// Escape helper — XSS protection
// ---------------------------------------------------------------------------

/**
 * Escapes HTML special characters to prevent XSS.
 *
 * @param {string} str - Raw string to escape.
 * @returns {string} HTML-safe string.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Render payment requests (admin view)
// ---------------------------------------------------------------------------

async function loadRequests() {
  const tbody   = document.getElementById('requests-tbody');
  const badge   = document.getElementById('requests-badge');
  const summary = document.getElementById('requests-summary');
  if (!tbody) return;

  try {
    const requests = await getPaymentRequests();
    const pending  = requests.filter(r => r.status === 'Pending');

    // Badge
    if (badge) {
      if (pending.length > 0) {
        badge.textContent = `${pending.length} pending`;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }
    if (summary) summary.textContent = `${requests.length} total, ${pending.length} pending`;

    if (!requests.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No payment requests yet.</td></tr>`;
      return;
    }

    const sorted = [...requests].sort((a, b) => {
      // Pending first, then by date desc
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
      return new Date(b.requestedOn) - new Date(a.requestedOn);
    });

    tbody.innerHTML = sorted.map(req => {
      let badge, actions = '';
      if (req.status === 'Pending') {
        badge   = `<span class="badge badge-warning">Pending</span>`;
        actions = `
          <button class="btn btn-success btn-sm" onclick="approveRequest('${escapeHtml(String(req.id))}')" style="margin-right:4px;">
            <i class="fas fa-check"></i> Approve
          </button>
          <button class="btn btn-danger btn-sm" onclick="rejectRequest('${escapeHtml(String(req.id))}', '${escapeHtml(req.memberName)}')">
            <i class="fas fa-times"></i> Reject
          </button>`;
      } else if (req.status === 'Approved') {
        badge   = `<span class="badge badge-success">Approved</span>`;
        actions = `<span style="font-size:0.75rem;color:var(--text-muted);">—</span>`;
      } else {
        badge   = `<span class="badge badge-danger">Rejected</span>`;
        actions = `<span style="font-size:0.75rem;color:var(--text-muted);">—</span>`;
      }

      return `
        <tr>
          <td>${escapeHtml(req.memberName)}</td>
          <td><strong>${escapeHtml(formatCurrency(req.amount))}</strong></td>
          <td>${escapeHtml(req.preferredDate || '—')}</td>
          <td>${escapeHtml(req.reason || '—')}</td>
          <td>${escapeHtml(req.requestedOn || '—')}</td>
          <td>${badge}</td>
          <td>${actions}</td>
        </tr>`;
    }).join('');

  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:1rem;color:var(--danger);">Failed to load requests.</td></tr>`;
  }
}

async function approveRequest(requestId) {
  try {
    // Get the request details
    const requests = await getPaymentRequests();
    const req = requests.find(r => String(r.id) === String(requestId));
    if (!req) { showToast('Request not found.', 'error'); return; }

    // Create actual payment
    await addPayment({
      memberId:   req.memberId,
      memberName: req.memberName,
      amount:     Number(req.amount),
      date:       req.preferredDate || new Date().toISOString().slice(0, 10),
      status:     'Paid',
    });

    // Mark request as approved
    await updatePaymentRequest(requestId, { ...req, status: 'Approved' });

    logActivity('approved', 'payment_request',
      `Payment of ${formatCurrency(req.amount)} approved for ${req.memberName}`,
      req.memberId, req.memberName);

    showToast(`✓ Payment of ${formatCurrency(req.amount)} approved for ${req.memberName}`);
    await loadRequests();
    await loadData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function rejectRequest(requestId, memberName) {
  if (!confirm(`Reject this payment request from ${memberName}?`)) return;
  try {
    const requests = await getPaymentRequests();
    const req = requests.find(r => String(r.id) === String(requestId));
    if (!req) { showToast('Request not found.', 'error'); return; }
    await updatePaymentRequest(requestId, { ...req, status: 'Rejected' });
    logActivity('rejected', 'payment_request',
      `Payment request of ${formatCurrency(req.amount)} rejected for ${memberName}`,
      req.memberId, memberName);
    showToast(`Request from ${memberName} rejected`);
    await loadRequests();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

window.approveRequest = approveRequest;
window.rejectRequest  = rejectRequest;

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Fetches members and payments from the API in parallel.
 * Populates the member dropdown and renders the payments table.
 */
async function loadData() {
  const tbody = document.getElementById('payments-tbody');
  showSpinner(tbody);

  try {
    const [members, payments] = await Promise.all([getMembers(), getPayments()]);

    allMembers = members;
    allPayments = payments;

    populateMemberDropdown(members);
    applySortAndFilter();
    renderTable();
  } catch (err) {
    showToast(`Error loading data: ${err.message}`, 'error');
    const tbody = document.getElementById('payments-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Failed to load payments.</td></tr>`;
    }
  }
}

/**
 * Populates the #payment-member <select> with options derived from the members array.
 *
 * @param {Array<object>} members - Array of member objects from the API.
 */
function populateMemberDropdown(members) {
  const select = document.getElementById('payment-member');
  if (!select) return;

  // Preserve the placeholder option
  select.innerHTML = '<option value="">-- Select member --</option>';

  members.forEach((member) => {
    const option = document.createElement('option');
    option.value = member.id;
    option.textContent = member.name;
    option.dataset.name = member.name;
    select.appendChild(option);
  });
}

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------

/**
 * Renders the payments table using the current `filteredPayments` array.
 */
function renderTable() {
  const tbody = document.getElementById('payments-tbody');
  if (!tbody) return;

  if (filteredPayments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">No payments found.</td>
      </tr>`;
    return;
  }

  const rows = filteredPayments.map((payment) => {
    const statusBadge =
      payment.status === 'Paid'
        ? `<span class="badge badge-success">Paid</span>`
        : payment.status === 'Pending'
        ? `<span class="badge badge-warning">Pending</span>`
        : `<span class="badge">${escapeHtml(payment.status)}</span>`;

    return `
      <tr>
        <td>${escapeHtml(payment.memberName)}</td>
        <td>${escapeHtml(formatCurrency(payment.amount))}</td>
        <td>${escapeHtml(payment.date)}</td>
        <td>${statusBadge}</td>
        <td class="action-buttons">
          <button
            class="btn btn-sm btn-primary"
            onclick="handleEdit('${escapeHtml(String(payment.id))}')"
            aria-label="Edit payment for ${escapeHtml(payment.memberName)}"
          >
            <i class="fas fa-edit"></i> Edit
          </button>
          <button
            class="btn btn-sm btn-danger"
            onclick="handleDelete('${escapeHtml(String(payment.id))}', '${escapeHtml(payment.memberName)}')"
            aria-label="Delete payment for ${escapeHtml(payment.memberName)}"
          >
            <i class="fas fa-trash"></i> Delete
          </button>
        </td>
      </tr>`;
  });

  tbody.innerHTML = rows.join('');
}

// ---------------------------------------------------------------------------
// Search and sort
// ---------------------------------------------------------------------------

/**
 * Filters `allPayments` by the current search query and sorts by the selected
 * sort option. Stores the result in `filteredPayments`.
 *
 * @returns {Array<object>} The filtered and sorted payments array.
 */
function applySortAndFilter() {
  const query = (document.getElementById('payment-search')?.value ?? '').trim().toLowerCase();
  const sortValue = document.getElementById('payment-sort')?.value ?? 'newest';

  // --- Filter ---
  let result = allPayments.filter((p) => {
    const haystack = [
      p.memberName ?? '',
      String(p.amount ?? ''),
      p.date ?? '',
      p.status ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  // --- Sort ---
  result = [...result].sort((a, b) => {
    switch (sortValue) {
      case 'newest':
        return new Date(b.date) - new Date(a.date);
      case 'oldest':
        return new Date(a.date) - new Date(b.date);
      case 'highest':
        return Number(b.amount) - Number(a.amount);
      case 'lowest':
        return Number(a.amount) - Number(b.amount);
      case 'name-az':
        return (a.memberName ?? '').localeCompare(b.memberName ?? '');
      case 'name-za':
        return (b.memberName ?? '').localeCompare(a.memberName ?? '');
      default:
        return 0;
    }
  });

  filteredPayments = result;
  return filteredPayments;
}

// ---------------------------------------------------------------------------
// Form validation helpers
// ---------------------------------------------------------------------------

/**
 * Clears all inline field error messages on the payment form.
 */
function clearErrors() {
  ['payment-member-error', 'payment-amount-error', 'payment-date-error', 'payment-status-error'].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    }
  );
}

/**
 * Validates the payment form fields.
 *
 * @param {string} memberId
 * @param {string} amount
 * @param {string} date
 * @param {string} status
 * @returns {boolean} True if all fields are valid, false otherwise.
 */
function validateForm(memberId, amount, date, status) {
  let valid = true;

  if (!memberId) {
    const el = document.getElementById('payment-member-error');
    if (el) el.textContent = 'Please select a member.';
    valid = false;
  }

  if (!amount || Number(amount) <= 0) {
    const el = document.getElementById('payment-amount-error');
    if (el) el.textContent = 'Amount must be greater than 0.';
    valid = false;
  }

  if (!date) {
    const el = document.getElementById('payment-date-error');
    if (el) el.textContent = 'Please select a date.';
    valid = false;
  }

  if (!status) {
    const el = document.getElementById('payment-status-error');
    if (el) el.textContent = 'Please select a status.';
    valid = false;
  }

  return valid;
}

// ---------------------------------------------------------------------------
// Balance check helper
// ---------------------------------------------------------------------------

/**
 * Checks whether a payment amount is within the member's available balance.
 *
 * Available balance = total contributions - total already paid (Paid status only).
 * When editing an existing payment, the original amount is added back so the
 * member isn't double-penalised for their own existing payment.
 *
 * @param {string} memberId        - The member being paid.
 * @param {number} paymentAmount   - The amount the admin wants to pay.
 * @param {string|null} editingId  - ID of the payment being edited (null = new payment).
 * @returns {{ ok: boolean, totalContributed: number, alreadyPaid: number, available: number }}
 */
async function checkBalance(memberId, paymentAmount, editingId) {
  const [contributions, payments] = await Promise.all([
    getContributions(),
    getPayments(),
  ]);

  // Sum everything this member has ever contributed
  const totalContributed = contributions
    .filter(c => String(c.memberId) === String(memberId))
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  // Sum payments already made to this member (Paid status only),
  // but exclude the record currently being edited so we don't block legitimate edits.
  const alreadyPaid = payments
    .filter(p =>
      String(p.memberId) === String(memberId) &&
      p.status === 'Paid' &&
      String(p.id) !== String(editingId)
    )
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const available = totalContributed - alreadyPaid;

  return {
    ok: paymentAmount <= available,
    totalContributed,
    alreadyPaid,
    available,
  };
}

// ---------------------------------------------------------------------------
// Form submit handler
// ---------------------------------------------------------------------------

/**
 * Handles the payment form submission for both add and edit operations.
 *
 * @param {Event} e - The form submit event.
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  clearErrors();

  const memberSelect = document.getElementById('payment-member');
  const memberId = memberSelect?.value ?? '';
  const memberName =
    memberSelect?.options[memberSelect.selectedIndex]?.dataset?.name ?? '';
  const amount = document.getElementById('payment-amount')?.value ?? '';
  const date = document.getElementById('payment-date')?.value ?? '';
  const status = document.getElementById('payment-status')?.value ?? '';

  if (!validateForm(memberId, amount, date, status)) return;

  const submitBtn = document.getElementById('payment-submit');
  if (submitBtn) submitBtn.disabled = true;

  try {
    // ── Balance check (only for 'Paid' status) ───────────────
    if (status === 'Paid') {
      const balance = await checkBalance(memberId, Number(amount), editingId);

      if (!balance.ok) {
        const amountErrorEl = document.getElementById('payment-amount-error');
        if (amountErrorEl) {
          amountErrorEl.textContent =
            `Insufficient balance. ${memberName} has contributed ${formatCurrency(balance.totalContributed)}, ` +
            `${formatCurrency(balance.alreadyPaid)} already paid out. ` +
            `Available: ${formatCurrency(balance.available)}.`;
        }
        showToast(
          `Payment blocked — amount exceeds ${memberName}'s available balance of ${formatCurrency(balance.available)}.`,
          'error'
        );
        return;
      }
    }

    const payload = {
      memberId,
      memberName,
      amount: Number(amount),
      date,
      status,
    };

    if (editingId) {
      await updatePayment(editingId, payload);
      showToast('✓ Payment Updated');
      logActivity('updated', 'payment', `Payment updated for ${memberName}`, memberId, memberName);
    } else {
      await addPayment(payload);
      showToast('✓ Payment Added');
      logActivity('created', 'payment', `Payment of ${formatCurrency(Number(amount))} added for ${memberName}`, memberId, memberName);
    }

    resetForm();
    await loadData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Reset form
// ---------------------------------------------------------------------------

/**
 * Resets the payment form to its initial "add" state.
 */
function resetForm() {
  document.getElementById('payment-form')?.reset();
  editingId = null;

  const submitBtn = document.getElementById('payment-submit');
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Payment';
  }

  clearErrors();
}

// ---------------------------------------------------------------------------
// Edit handler (exposed globally for inline onclick)
// ---------------------------------------------------------------------------

/**
 * Pre-fills the form with the selected payment's data for editing.
 *
 * @param {string} id - The payment ID to edit.
 */
function handleEdit(id) {
  const payment = allPayments.find((p) => String(p.id) === String(id));
  if (!payment) return;

  editingId = payment.id;

  // Pre-fill fields
  const memberSelect = document.getElementById('payment-member');
  if (memberSelect) memberSelect.value = payment.memberId;

  const amountInput = document.getElementById('payment-amount');
  if (amountInput) amountInput.value = payment.amount;

  const dateInput = document.getElementById('payment-date');
  if (dateInput) dateInput.value = payment.date;

  const statusSelect = document.getElementById('payment-status');
  if (statusSelect) statusSelect.value = payment.status;

  // Update submit button label
  const submitBtn = document.getElementById('payment-submit');
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Payment';
  }

  clearErrors();

  // Scroll form into view on mobile
  document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Delete handler (exposed globally for inline onclick)
// ---------------------------------------------------------------------------

/**
 * Confirms and deletes a payment by ID.
 *
 * @param {string} id - The payment ID to delete.
 * @param {string} memberName - The member's name (used for toast and activity log).
 */
async function handleDelete(id, memberName) {
  if (!confirm(`Delete this payment for ${memberName}? This cannot be undone.`)) return;

  try {
    await deletePayment(id);
    showToast('✓ Deleted Successfully');
    logActivity('deleted', 'payment', `Payment deleted for ${memberName}`, id, memberName);
    await loadData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Expose handlers to global scope (required for inline onclick attributes)
// ---------------------------------------------------------------------------

window.handleEdit = handleEdit;
window.handleDelete = handleDelete;

// ---------------------------------------------------------------------------
// DOMContentLoaded bootstrap
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

  // 2. Load data
  loadData();
  loadRequests();

  // 3. Live balance preview when member is selected
  const memberSelect = document.getElementById('payment-member');
  if (memberSelect) {
    memberSelect.addEventListener('change', async () => {
      const memberId   = memberSelect.value;
      const memberName = memberSelect.options[memberSelect.selectedIndex]?.dataset?.name ?? '';
      const previewEl  = document.getElementById('balance-preview');

      if (!memberId || !previewEl) return;

      previewEl.textContent = 'Calculating…';
      previewEl.style.color = 'var(--text-muted)';

      try {
        const balance = await checkBalance(memberId, 0, null);
        if (balance.available <= 0) {
          previewEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${memberName} has no available balance (contributed ${formatCurrency(balance.totalContributed)}, paid ${formatCurrency(balance.alreadyPaid)})`;
          previewEl.style.color = 'var(--danger)';
        } else {
          previewEl.innerHTML = `<i class="fas fa-info-circle"></i> Available balance: <strong>${formatCurrency(balance.available)}</strong> (contributed ${formatCurrency(balance.totalContributed)}, paid out ${formatCurrency(balance.alreadyPaid)})`;
          previewEl.style.color = 'var(--success)';
        }
      } catch {
        previewEl.textContent = '';
      }
    });
  }

  // 4. Wire form submit
  const form = document.getElementById('payment-form');
  if (form) form.addEventListener('submit', handleFormSubmit);

  // 5. Wire search (keyup) → filter + render
  const searchInput = document.getElementById('payment-search');
  if (searchInput) {
    searchInput.addEventListener('keyup', () => {
      applySortAndFilter();
      renderTable();
    });
  }

  // 6. Wire sort (change) → filter + render
  const sortSelect = document.getElementById('payment-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      applySortAndFilter();
      renderTable();
    });
  }
});
