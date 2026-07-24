import { requireMember, logout } from './auth.js';
import { getPayments, getContributions, getPaymentRequests, addPaymentRequest, deletePaymentRequest } from './api.js';
import { showToast, showSpinner, hideSpinner, formatCurrency, logActivity } from './utils.js';

const PAGE_ID = 'user-payments';
const BASE_URL = 'http://localhost:3000';

let allMyPayments = [];
let allMyRequests = [];
let currentUser   = null;
let memberData    = null;

// ── Fetch member record ───────────────────────────────────────
async function fetchMember() {
  const res = await fetch(`${BASE_URL}/members/${currentUser.id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Savings maturity check ────────────────────────────────────
function getSavingsStatus(member) {
  if (!member?.savingsDuration || !member?.savingsStartDate) {
    return { matured: false, noPlan: true, endDate: null, daysLeft: null, isFlexible: false };
  }

  // Flexible withdrawal — always allowed
  if (member.withdrawalType === 'flexible') {
    const start = new Date(member.savingsStartDate);
    const end   = new Date(start);
    end.setMonth(end.getMonth() + member.savingsDuration);
    return { matured: true, noPlan: false, endDate: end.toISOString().slice(0, 10), daysLeft: 0, isFlexible: true };
  }

  // Fixed withdrawal — locked until end date
  const start    = new Date(member.savingsStartDate);
  const end      = new Date(start);
  end.setMonth(end.getMonth() + member.savingsDuration);
  const now      = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((end - now) / 86400000);
  return { matured: daysLeft <= 0, noPlan: false, endDate: end.toISOString().slice(0, 10), daysLeft, isFlexible: false };
}

// ── Nav ───────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────
function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' });
}

// ── Render payment requests ────────────────────────────────────
function renderRequests() {
  const tbody  = document.getElementById('my-requests-tbody');
  const count  = document.getElementById('requests-count');
  if (!tbody) return;

  if (count) count.textContent = `${allMyRequests.length} request${allMyRequests.length !== 1 ? 's' : ''}`;

  if (!allMyRequests.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">No requests submitted yet.</td></tr>`;
    return;
  }

  const sorted = [...allMyRequests].sort((a, b) => new Date(b.requestedOn) - new Date(a.requestedOn));

  tbody.innerHTML = sorted.map(req => {
    let badge, actions = '';

    if (req.status === 'Pending') {
      badge   = `<span class="badge badge-warning">Pending</span>`;
      actions = `<button class="btn btn-danger btn-sm" onclick="cancelRequest('${req.id}')">
                   <i class="fas fa-times"></i> Cancel
                 </button>`;
    } else if (req.status === 'Approved') {
      badge   = `<span class="badge badge-success">Approved</span>`;
      actions = `<span style="font-size:0.75rem;color:var(--success);font-weight:500;"><i class="fas fa-check"></i> Paid</span>`;
    } else {
      badge   = `<span class="badge badge-danger">Rejected</span>`;
      actions = `<span style="font-size:0.75rem;color:var(--text-muted);">—</span>`;
    }

    return `
      <tr>
        <td><strong>${escapeHtml(formatCurrency(req.amount))}</strong></td>
        <td>${escapeHtml(formatDate(req.preferredDate))}</td>
        <td>${escapeHtml(req.reason || '—')}</td>
        <td>${escapeHtml(formatDate(req.requestedOn))}</td>
        <td>${badge}</td>
        <td>${actions}</td>
      </tr>`;
  }).join('');
}

// ── Cancel a pending request ───────────────────────────────────
async function cancelRequest(id) {
  if (!confirm('Cancel this payment request?')) return;
  try {
    await deletePaymentRequest(id);
    showToast('Request cancelled');
    await loadAll();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}
window.cancelRequest = cancelRequest;

// ── Render payment history ─────────────────────────────────────
function applyFilter() {
  const query   = (document.getElementById('payments-search')?.value ?? '').trim().toLowerCase();
  const sortVal = document.getElementById('payments-sort')?.value ?? 'newest';

  let result = allMyPayments.filter(p =>
    !query || String(p.amount).includes(query) || (p.date ?? '').includes(query) || (p.status ?? '').toLowerCase().includes(query)
  );
  result = [...result].sort((a, b) => {
    switch (sortVal) {
      case 'newest':      return new Date(b.date) - new Date(a.date);
      case 'oldest':      return new Date(a.date) - new Date(b.date);
      case 'amount-high': return Number(b.amount) - Number(a.amount);
      case 'amount-low':  return Number(a.amount) - Number(b.amount);
      default:            return 0;
    }
  });
  return result;
}

function renderPayments() {
  const tbody   = document.getElementById('my-payments-tbody');
  const totalEl = document.getElementById('payments-total');
  if (!tbody) return;

  const totalReceived = allMyPayments.filter(p => p.status === 'Paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  if (totalEl) totalEl.textContent = `Total received: ${formatCurrency(totalReceived)}`;

  const rows = applyFilter();
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted);">No payments yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((p, i) => {
    const badge = p.status === 'Paid'
      ? `<span class="badge badge-success">Paid</span>`
      : `<span class="badge badge-warning">Pending</span>`;
    return `<tr><td>${i+1}</td><td><strong>${escapeHtml(formatCurrency(p.amount))}</strong></td><td>${escapeHtml(formatDate(p.date))}</td><td>${badge}</td></tr>`;
  }).join('');
}

// ── Load all data ──────────────────────────────────────────────
async function loadAll() {
  try {
    const [allPayments, allRequests] = await Promise.all([getPayments(), getPaymentRequests()]);
    allMyPayments = allPayments.filter(p => String(p.memberId) === String(currentUser.id));
    allMyRequests = allRequests.filter(r => String(r.memberId) === String(currentUser.id));
    renderRequests();
    renderPayments();
  } catch (err) {
    showToast(`Error loading data: ${err.message}`, 'error');
  }
}

// ── Request form submit ────────────────────────────────────────
async function handleRequestSubmit(e) {
  e.preventDefault();

  // ── Check savings plan maturity first ──────────────────────
  const status = getSavingsStatus(memberData);
  if (status.noPlan) {
    showToast('Set up a savings plan on the Contributions page before requesting payment.', 'error');
    return;
  }
  if (!status.matured) {
    showToast(`Fixed plan locked — matures in ${status.daysLeft} day${status.daysLeft !== 1 ? 's' : ''} on ${status.endDate}. Requests open after that date.`, 'error');
    return;
  }

  // Clear errors
  ['req-amount-error', 'req-date-error'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
  ['req-amount', 'req-date'].forEach(id => document.getElementById(id)?.classList.remove('invalid'));

  const amount = document.getElementById('req-amount')?.value;
  const date   = document.getElementById('req-date')?.value;
  const reason = document.getElementById('req-reason')?.value.trim() || '';

  let hasError = false;
  if (!amount || Number(amount) <= 0) {
    document.getElementById('req-amount')?.classList.add('invalid');
    const el = document.getElementById('req-amount-error');
    if (el) el.textContent = 'Please enter a valid amount.';
    hasError = true;
  }
  if (!date) {
    document.getElementById('req-date')?.classList.add('invalid');
    const el = document.getElementById('req-date-error');
    if (el) el.textContent = 'Please select a preferred date.';
    hasError = true;
  }
  if (hasError) return;

  // Check available balance
  try {
    const [allContributions, allPayments] = await Promise.all([getContributions(), getPayments()]);
    const totalContributed = allContributions
      .filter(c => String(c.memberId) === String(currentUser.id))
      .reduce((s, c) => s + Number(c.amount || 0), 0);
    const alreadyPaid = allPayments
      .filter(p => String(p.memberId) === String(currentUser.id) && p.status === 'Paid')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const available = totalContributed - alreadyPaid;

    if (Number(amount) > available) {
      document.getElementById('req-amount')?.classList.add('invalid');
      const el = document.getElementById('req-amount-error');
      if (el) el.textContent = `Amount exceeds your available balance of ${formatCurrency(available)}.`;
      return;
    }
  } catch (err) {
    showToast(`Could not verify balance: ${err.message}`, 'error');
    return;
  }

  const btn = document.getElementById('req-submit');
  if (btn) btn.disabled = true;

  try {
    await addPaymentRequest({
      memberId:      String(currentUser.id),
      memberName:    currentUser.name,
      amount:        Number(amount),
      preferredDate: date,
      reason,
      status:        'Pending',
      requestedOn:   new Date().toISOString().slice(0, 10),
    });

    logActivity('pending', 'payment_request',
      `${currentUser.name} requested payment of ${formatCurrency(Number(amount))}`,
      currentUser.id, currentUser.name);

    showToast('✓ Payment request submitted — awaiting admin approval');
    document.getElementById('payment-request-form')?.reset();
    await loadAll();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = requireMember();
  if (!currentUser) return;

  initNav();

  try {
    memberData = await fetchMember();
  } catch (err) {
    // Non-fatal — payment requests will just show the plan warning
  }

  // Show savings plan status banner above the request form
  renderPlanStatusBanner();

  document.getElementById('payment-request-form')?.addEventListener('submit', handleRequestSubmit);
  document.getElementById('payments-search')?.addEventListener('keyup', renderPayments);
  document.getElementById('payments-sort')?.addEventListener('change', renderPayments);

  await loadAll();
});

function renderPlanStatusBanner() {
  const formCard = document.querySelector('#payment-request-form')?.closest('.card');
  if (!formCard) return;

  const existing = document.getElementById('plan-status-banner');
  if (existing) existing.remove();

  const status = getSavingsStatus(memberData);
  const banner = document.createElement('div');
  banner.id = 'plan-status-banner';

  if (status.noPlan) {
    banner.innerHTML = `
      <div style="background:var(--warning-faint);border:1px solid #fed7aa;border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:0.875rem;color:#92400e;display:flex;align-items:center;gap:10px;">
        <i class="fas fa-exclamation-triangle" style="flex-shrink:0;"></i>
        <span>You don't have a savings plan yet. <a href="user-contributions.html" style="color:var(--primary);font-weight:600;text-decoration:none;">Set up your plan</a> on the Contributions page to unlock payment requests.</span>
      </div>`;
  } else if (status.isFlexible) {
    banner.innerHTML = `
      <div style="background:var(--success-faint);border:1px solid #a7f3d0;border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:0.875rem;color:#065f46;display:flex;align-items:center;gap:10px;">
        <i class="fas fa-calendar-check" style="flex-shrink:0;"></i>
        <span><strong>Flexible Withdrawal Plan</strong> — You can request a payment at any time. Your plan ends on <strong>${status.endDate}</strong>.</span>
      </div>`;
  } else if (!status.matured) {
    banner.innerHTML = `
      <div style="background:var(--primary-faint);border:1px solid #c7d2fe;border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:0.875rem;color:#3730a3;display:flex;align-items:center;gap:10px;">
        <i class="fas fa-lock" style="flex-shrink:0;"></i>
        <span><strong>Fixed Withdrawal Plan</strong> — Matures on <strong>${status.endDate}</strong>. <strong>${status.daysLeft} day${status.daysLeft !== 1 ? 's' : ''}</strong> remaining before you can request payment.</span>
      </div>`;
  } else {
    banner.innerHTML = `
      <div style="background:var(--success-faint);border:1px solid #a7f3d0;border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:0.875rem;color:#065f46;display:flex;align-items:center;gap:10px;">
        <i class="fas fa-check-circle" style="flex-shrink:0;"></i>
        <span><strong>Fixed Withdrawal Plan matured!</strong> Your savings period has ended — you can now request your payment below.</span>
      </div>`;
  }

  formCard.insertBefore(banner, formCard.querySelector('form'));
}
