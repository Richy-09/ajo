import { requireMember, logout } from './auth.js';
import { getContributions, getPayments, getPaymentRequests } from './api.js';
import { showToast, showSpinner, hideSpinner, formatCurrency } from './utils.js';

const PAGE_ID = 'user-reports';

// ─────────────────────────────────────────────────────────────
// Nav init
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────────────────────

function initTabs() {
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const targetId = `tab-${btn.dataset.tab}`;
      tabPanels.forEach(p => { p.style.display = p.id === targetId ? 'block' : 'none'; });
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' });
}

function summaryRow(label, value, valueStyle = '') {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:10px 0;border-bottom:1px solid var(--border-light);">
      <span style="font-size:0.875rem;color:var(--text-muted);">${label}</span>
      <strong style="font-size:0.9rem;color:var(--text);${valueStyle}">${value}</strong>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Render functions
// ─────────────────────────────────────────────────────────────

function renderStats(contributions, payments, requests) {
  const totalContrib       = contributions.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalPaid          = payments.filter(p => p.status === 'Paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  // Pending = approved-but-pending payments + pending requests not yet actioned
  const pendingPayments    = payments.filter(p => p.status === 'Pending').reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingRequests    = requests.filter(r => r.status === 'Pending').reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalPending       = pendingPayments + pendingRequests;
  const balance            = totalContrib - totalPaid;

  const cards = [
    { colour:'green',  icon:'fa-hand-holding-usd', value: formatCurrency(totalContrib), label:'Total Contributed' },
    { colour:'blue',   icon:'fa-money-check-alt',  value: formatCurrency(totalPaid),    label:'Total Received'    },
    { colour:'orange', icon:'fa-clock',             value: formatCurrency(totalPending), label:'Pending'           },
    { colour:'purple', icon:'fa-balance-scale',     value: formatCurrency(balance),      label:'My Balance'        },
  ];

  const grid = document.getElementById('report-stats');
  if (grid) {
    hideSpinner(grid, cards.map(c => `
      <div class="stat-card">
        <div class="stat-icon ${c.colour}"><i class="fas ${c.icon}"></i></div>
        <div class="stat-info">
          <span class="stat-value">${c.value}</span>
          <span class="stat-label">${c.label}</span>
        </div>
      </div>
    `).join(''));
  }

  return { totalContrib, totalPaid, totalPending, balance };
}

function renderContribSummary(contributions) {
  const el = document.getElementById('contrib-summary');
  if (!el) return;

  if (!contributions.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;padding:8px 0;">No contributions yet.</p>';
    return;
  }

  const total  = contributions.reduce((s, c) => s + Number(c.amount || 0), 0);
  const count  = contributions.length;
  const avg    = total / count;
  const sorted = [...contributions].sort((a,b) => Number(b.amount) - Number(a.amount));
  const highest = sorted[0];
  const lowest  = sorted[sorted.length - 1];
  const latest  = [...contributions].sort((a,b) => new Date(b.date) - new Date(a.date))[0];

  el.innerHTML =
    summaryRow('Total Contributions', formatCurrency(total)) +
    summaryRow('Number of Payments', `${count}`) +
    summaryRow('Average per Payment', formatCurrency(avg)) +
    summaryRow('Highest Single Payment', formatCurrency(highest.amount)) +
    summaryRow('Lowest Single Payment', formatCurrency(lowest.amount)) +
    summaryRow('Most Recent', formatDate(latest.date));
}

function renderPaymentSummary(payments, requests) {
  const el = document.getElementById('payment-summary');
  if (!el) return;

  const paid             = payments.filter(p => p.status === 'Paid');
  const pendingPayments  = payments.filter(p => p.status === 'Pending');
  const pendingRequests  = requests.filter(r => r.status === 'Pending');
  const rejectedRequests = requests.filter(r => r.status === 'Rejected');

  const totalPaid     = paid.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPending  = pendingPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
                      + pendingRequests.reduce((s, r) => s + Number(r.amount || 0), 0);

  const allItems      = [...payments, ...requests];
  if (!allItems.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;padding:8px 0;">No payments or requests yet.</p>';
    return;
  }

  const latestPaid    = [...paid].sort((a,b) => new Date(b.date) - new Date(a.date))[0];

  el.innerHTML =
    summaryRow('Total Received (Paid)',   formatCurrency(totalPaid),    'color:var(--success);') +
    summaryRow('Pending (requests+payments)', formatCurrency(totalPending), 'color:var(--warning);') +
    summaryRow('Paid Disbursements',      `${paid.length}`) +
    summaryRow('Pending Requests',        `${pendingRequests.length}`) +
    summaryRow('Rejected Requests',       `${rejectedRequests.length}`) +
    summaryRow('Last Payment Received',   latestPaid ? formatDate(latestPaid.date) : '—');
}

function renderMonthlyBreakdown(contributions) {
  const el = document.getElementById('monthly-breakdown');
  if (!el) return;

  if (!contributions.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;padding:8px 0;">No data yet.</p>';
    return;
  }

  // Group by YYYY-MM
  const byMonth = contributions.reduce((acc, c) => {
    const month = (c.date || '').slice(0, 7);
    if (!month) return acc;
    if (!acc[month]) acc[month] = { count: 0, total: 0 };
    acc[month].count++;
    acc[month].total += Number(c.amount || 0);
    return acc;
  }, {});

  const months = Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a));
  const grandTotal = months.reduce((s, [, v]) => s + v.total, 0);

  const rows = months.map(([month, data]) => {
    const [year, m] = month.split('-');
    const label = new Date(Number(year), Number(m) - 1, 1)
      .toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
    const pct = grandTotal > 0 ? Math.round((data.total / grandTotal) * 100) : 0;

    return `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td>${data.count}</td>
        <td><strong>${escapeHtml(formatCurrency(data.total))}</strong></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:6px;background:var(--border);border-radius:9999px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:9999px;"></div>
            </div>
            <span style="font-size:0.75rem;color:var(--text-muted);width:30px;text-align:right;">${pct}%</span>
          </div>
        </td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Payments</th>
            <th>Amount (₦)</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderContribTable(contributions) {
  const el    = document.getElementById('report-contrib-table');
  const count = document.getElementById('contrib-count');
  if (!el) return;

  if (count) count.textContent = `${contributions.length} record${contributions.length !== 1 ? 's' : ''}`;

  if (!contributions.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;padding:12px 0;">No contributions recorded yet.</p>';
    return;
  }

  const sorted = [...contributions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const rows   = sorted.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(formatCurrency(c.amount))}</strong></td>
      <td>${escapeHtml(formatDate(c.date))}</td>
      <td><span class="badge badge-success">Recorded</span></td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>#</th><th>Amount (₦)</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderPaymentsTable(payments, requests) {
  const el    = document.getElementById('report-payments-table');
  const count = document.getElementById('payments-count');
  if (!el) return;

  // Merge actual payments with payment requests (show requests as pending entries)
  const requestsAsRows = requests.map(r => ({
    amount:      r.amount,
    date:        r.preferredDate || r.requestedOn,
    status:      r.status === 'Approved' ? 'Paid'
               : r.status === 'Rejected' ? 'Rejected'
               : 'Requested',
    isRequest:   true,
    requestedOn: r.requestedOn,
    reason:      r.reason,
  }));

  const combined = [
    ...payments.map(p => ({ ...p, isRequest: false })),
    ...requestsAsRows,
  ].sort((a, b) => new Date(b.date || b.requestedOn) - new Date(a.date || a.requestedOn));

  if (count) count.textContent = `${combined.length} record${combined.length !== 1 ? 's' : ''}`;

  if (!combined.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;padding:12px 0;">No payments or requests yet.</p>';
    return;
  }

  const rows = combined.map((p, i) => {
    let badge;
    if (p.status === 'Paid')     badge = `<span class="badge badge-success">Paid</span>`;
    else if (p.status === 'Rejected') badge = `<span class="badge badge-danger">Rejected</span>`;
    else if (p.status === 'Requested') badge = `<span class="badge badge-warning"><i class="fas fa-clock" style="margin-right:3px;font-size:0.6rem;"></i>Pending Request</span>`;
    else badge = `<span class="badge badge-warning">Pending</span>`;

    const note = p.isRequest && p.reason ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${escapeHtml(p.reason)}</div>` : '';

    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(formatCurrency(p.amount))}</strong></td>
        <td>${escapeHtml(formatDate(p.date || p.requestedOn))}${note}</td>
        <td>${badge}</td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>#</th><th>Amount (₦)</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = requireMember();
  if (!currentUser) return;

  initNav();
  initTabs();

  const grid = document.getElementById('report-stats');
  showSpinner(grid);

  try {
    const [allContributions, allPayments, allRequests] = await Promise.all([
      getContributions(),
      getPayments(),
      getPaymentRequests(),
    ]);

    // Filter to this member only
    const myContributions = allContributions.filter(c => String(c.memberId) === String(currentUser.id));
    const myPayments      = allPayments.filter(p => String(p.memberId) === String(currentUser.id));
    const myRequests      = allRequests.filter(r => String(r.memberId) === String(currentUser.id));

    renderStats(myContributions, myPayments, myRequests);
    renderContribSummary(myContributions);
    renderPaymentSummary(myPayments, myRequests);
    renderMonthlyBreakdown(myContributions);
    renderContribTable(myContributions);
    renderPaymentsTable(myPayments, myRequests);

  } catch (err) {
    hideSpinner(grid, '');
    showToast(`Failed to load reports: ${err.message}`, 'error');
  }
});
