/**
 * reports.js — Reports page logic
 *
 * Fetches all data in parallel, computes summary metrics, renders read-only
 * tables for each tab, and handles tab switching without a page reload.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */

import { getMembers, getContributions, getPayments } from './api.js';
import { showToast, showSpinner, hideSpinner, formatCurrency } from './utils.js';
import { requireAdmin } from './auth.js';

const PAGE_ID = 'reports';

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
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Metric computation
// ---------------------------------------------------------------------------

/**
 * Finds the name of the member with the highest total contribution amount.
 *
 * @param {Array<object>} members
 * @param {Array<object>} contributions
 * @returns {string} Member name or '—' if no data.
 */
function findTopContributor(members, contributions) {
  if (!contributions.length) return '—';

  // Sum contributions per memberId
  const totals = contributions.reduce((acc, c) => {
    const id = c.memberId;
    acc[id] = (acc[id] || 0) + Number(c.amount || 0);
    return acc;
  }, {});

  // Find the memberId with the highest total
  const topId = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!topId) return '—';

  // Look up name — fall back to the memberName stored on the contribution
  const member = members.find((m) => String(m.id) === String(topId));
  if (member) return member.name;

  const fallbackContrib = contributions.find((c) => String(c.memberId) === String(topId));
  return fallbackContrib?.memberName ?? '—';
}

// ---------------------------------------------------------------------------
// Table builders (read-only, no forms)
// ---------------------------------------------------------------------------

/**
 * Builds a read-only contributions table HTML string.
 *
 * @param {Array<object>} contributions
 * @returns {string}
 */
function buildContributionsTable(contributions) {
  if (!contributions.length) {
    return '<p style="color:#64748b;font-size:0.875rem;">No contributions recorded yet.</p>';
  }

  const rows = contributions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.memberName)}</td>
        <td>${escapeHtml(formatCurrency(c.amount))}</td>
        <td>${escapeHtml(c.date)}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Amount (₦)</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/**
 * Builds a read-only payments table HTML string.
 *
 * @param {Array<object>} payments
 * @returns {string}
 */
function buildPaymentsTable(payments) {
  if (!payments.length) {
    return '<p style="color:#64748b;font-size:0.875rem;">No payments recorded yet.</p>';
  }

  const rows = payments
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((p) => {
      const badge =
        p.status === 'Paid'
          ? `<span class="badge badge-success">Paid</span>`
          : p.status === 'Pending'
          ? `<span class="badge badge-warning">Pending</span>`
          : `<span class="badge">${escapeHtml(p.status)}</span>`;

      return `
      <tr>
        <td>${escapeHtml(p.memberName)}</td>
        <td>${escapeHtml(formatCurrency(p.amount))}</td>
        <td>${escapeHtml(p.date)}</td>
        <td>${badge}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Amount (₦)</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/**
 * Builds a read-only members table HTML string.
 * Includes deleted members inferred from contribution/payment records.
 *
 * @param {Array<object>} members       - Current live members from API.
 * @param {Array<object>} contributions - All contributions (used to recover deleted member names).
 * @param {Array<object>} payments      - All payments (used to recover deleted member names).
 * @returns {string}
 */
function buildMembersTable(members, contributions, payments) {
  // Build a set of current member IDs for quick lookup
  const activeMemberIds = new Set(members.map(m => String(m.id)));

  // Collect deleted members from contribution/payment records
  const deletedMap = new Map(); // memberId → memberName
  [...contributions, ...payments].forEach(record => {
    const id = String(record.memberId);
    if (!activeMemberIds.has(id) && !deletedMap.has(id)) {
      deletedMap.set(id, record.memberName || `Member #${id}`);
    }
  });

  const deletedMembers = Array.from(deletedMap.entries()).map(([id, name]) => ({
    id,
    name,
    phone: '—',
    status: 'Deleted',
    isDeleted: true,
  }));

  const allMembers = [...members, ...deletedMembers];

  if (!allMembers.length) {
    return '<p style="color:#64748b;font-size:0.875rem;">No members yet.</p>';
  }

  const rows = allMembers
    .map((m) => {
      let badge;
      if (m.isDeleted) {
        badge = `<span class="badge" style="background:#f1f5f9;color:#64748b;">Deleted</span>`;
      } else if (m.status === 'Active') {
        badge = `<span class="badge badge-success">Active</span>`;
      } else {
        badge = `<span class="badge badge-danger">${escapeHtml(m.status)}</span>`;
      }

      const rowStyle = m.isDeleted ? 'style="opacity:0.6;"' : '';

      return `
      <tr ${rowStyle}>
        <td>${escapeHtml(m.name)}${m.isDeleted ? ' <small style="color:#94a3b8;">(removed)</small>' : ''}</td>
        <td>${escapeHtml(m.phone)}</td>
        <td>${badge}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

/**
 * Wires click handlers on all .tab-btn elements to show/hide .tab-panel divs
 * without a page reload.
 */
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Update button active states
      tabBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      // Show matching panel, hide others
      const targetId = `tab-${btn.dataset.tab}`;
      tabPanels.forEach((panel) => {
        panel.style.display = panel.id === targetId ? 'block' : 'none';
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Main init
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

  // 2. Init tabs
  initTabs();

  // 4. Show spinner in summary tab while loading
  const summaryTab = document.getElementById('tab-summary');
  showSpinner(summaryTab);

  // 5. Fetch all data in parallel
  Promise.all([getMembers(), getContributions(), getPayments()])
    .then(([members, contributions, payments]) => {

      // --- Compute metrics ---
      const totalContributions = contributions.reduce((s, c) => s + Number(c.amount || 0), 0);
      const totalPayments      = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const totalSavings       = totalPayments; // Total Savings = sum of all Payments per design
      const outstandingBalance = totalContributions - totalPayments;
      const activeMembersCount = members.filter((m) => m.status === 'Active').length;
      const topContributor     = findTopContributor(members, contributions);

      // --- Restore summary tab and populate metric spans ---
      // Rebuild the stats-grid HTML (spinner replaced the content)
      hideSpinner(summaryTab, document.getElementById('tab-summary')?.innerHTML ?? '');

      // summaryTab content was wiped by showSpinner, so we set the spans directly
      // by restoring the original structure via innerHTML
      summaryTab.innerHTML = `
        <div class="stats-grid" style="margin-bottom:0;">
          <div class="stat-card">
            <div class="stat-icon blue"><i class="fas fa-piggy-bank"></i></div>
            <div class="stat-info">
              <span class="stat-value" id="metric-savings">${escapeHtml(formatCurrency(totalSavings))}</span>
              <span class="stat-label">Total Savings</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green"><i class="fas fa-hand-holding-usd"></i></div>
            <div class="stat-info">
              <span class="stat-value" id="metric-contributions">${escapeHtml(formatCurrency(totalContributions))}</span>
              <span class="stat-label">Total Contributions</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon orange"><i class="fas fa-money-bill-wave"></i></div>
            <div class="stat-info">
              <span class="stat-value" id="metric-payments">${escapeHtml(formatCurrency(totalPayments))}</span>
              <span class="stat-label">Total Payments</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon purple"><i class="fas fa-balance-scale"></i></div>
            <div class="stat-info">
              <span class="stat-value" id="metric-balance">${escapeHtml(formatCurrency(outstandingBalance))}</span>
              <span class="stat-label">Outstanding Balance</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue"><i class="fas fa-users"></i></div>
            <div class="stat-info">
              <span class="stat-value" id="metric-active-members">${activeMembersCount}</span>
              <span class="stat-label">Active Members</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green"><i class="fas fa-trophy"></i></div>
            <div class="stat-info">
              <span class="stat-value" id="metric-top-contributor" style="font-size:1rem;">${escapeHtml(topContributor)}</span>
              <span class="stat-label">Top Contributor</span>
            </div>
          </div>
        </div>`;

      // --- Render read-only tables in other tabs ---
      const contribTableEl = document.getElementById('report-contributions-table');
      if (contribTableEl) contribTableEl.innerHTML = buildContributionsTable(contributions);

      const paymentsTableEl = document.getElementById('report-payments-table');
      if (paymentsTableEl) paymentsTableEl.innerHTML = buildPaymentsTable(payments);

      const membersTableEl = document.getElementById('report-members-table');
      if (membersTableEl) membersTableEl.innerHTML = buildMembersTable(members, contributions, payments);
    })
    .catch((err) => {
      // Restore empty summary tab and show error toast
      if (summaryTab) summaryTab.innerHTML = '<p style="color:var(--danger);">Failed to load report data.</p>';
      showToast(err.message, 'error');
    });
});
