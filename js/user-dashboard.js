import { requireMember, logout } from './auth.js';
import { getContributions, getPayments, getPaymentRequests, getActivities as fetchActivities } from './api.js';
import { showToast, showSpinner, hideSpinner, formatCurrency } from './utils.js';

const PAGE_ID = 'user-dashboard';

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

function timeAgo(isoTimestamp) {
  const diff    = Date.now() - new Date(isoTimestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Activity icon/colour map ──────────────────────────────────
function activityStyle(activity) {
  const resourceMap = {
    contribution:    { icon: 'fa-hand-holding-usd', colour: '#059669' },
    payment:         { icon: 'fa-money-bill-wave',  colour: '#d97706' },
    payment_request: { icon: 'fa-paper-plane',       colour: '#4f46e5' },
    member:          { icon: 'fa-user',              colour: '#7c3aed' },
  };
  const typeColour = {
    created:  '#059669',
    updated:  '#2563eb',
    deleted:  '#dc2626',
    approved: '#059669',
    rejected: '#dc2626',
    pending:  '#d97706',
  };
  const base = resourceMap[activity.resource] || { icon: 'fa-bolt', colour: '#64748b' };
  const colour = typeColour[activity.type] || base.colour;
  return { icon: base.icon, colour };
}

// ── Render activity feed ──────────────────────────────────────
function renderActivityFeed(activities, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!activities.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;padding:8px 0;">No recent activity.</p>';
    return;
  }

  el.innerHTML = activities.map(a => {
    const { icon, colour } = activityStyle(a);
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-light);">
        <div style="width:34px;height:34px;border-radius:50%;background:${colour}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.85rem;color:${colour};">
          <i class="fas ${icon}"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <p style="font-size:0.8125rem;margin:0;line-height:1.4;color:var(--text);">${escapeHtml(a.description)}</p>
          <span style="font-size:0.72rem;color:var(--text-light);">${timeAgo(a.timestamp)}</span>
        </div>
      </div>`;
  }).join('');
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = requireMember();
  if (!currentUser) return;

  initNav();

  // Personalise heading
  const heading = document.getElementById('welcome-heading');
  if (heading) heading.textContent = `Welcome, ${currentUser.name.split(' ')[0]}`;

  const statsGrid = document.getElementById('user-stats');
  showSpinner(statsGrid);

  try {
    const [allContributions, allPayments, allRequests, allActivities] = await Promise.all([
      getContributions(),
      getPayments(),
      getPaymentRequests(),
      fetchActivities(),
    ]);

    // Filter to current user
    const myContributions = allContributions.filter(c => String(c.memberId) === String(currentUser.id));
    const myPayments      = allPayments.filter(p => String(p.memberId) === String(currentUser.id));
    const myRequests      = allRequests.filter(r => String(r.memberId) === String(currentUser.id));

    // Pending = pending payments + pending requests
    const pendingPay  = myPayments.filter(p => p.status === 'Pending').reduce((s, p) => s + Number(p.amount || 0), 0);
    const pendingReq  = myRequests.filter(r => r.status === 'Pending').reduce((s, r) => s + Number(r.amount || 0), 0);

    const totalContributed = myContributions.reduce((s, c) => s + Number(c.amount || 0), 0);
    const totalReceived    = myPayments.filter(p => p.status === 'Paid').reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalPending     = pendingPay + pendingReq;

    // Stat cards
    const cards = [
      { colour:'green',  icon:'fa-hand-holding-usd', value: formatCurrency(totalContributed), label:'My Total Contributions' },
      { colour:'blue',   icon:'fa-money-check-alt',  value: formatCurrency(totalReceived),    label:'Total Received'         },
      { colour:'orange', icon:'fa-clock',             value: formatCurrency(totalPending),     label:'Pending'                },
      { colour:'purple', icon:'fa-list-ol',           value: String(myContributions.length),   label:'Contributions Made'     },
    ];

    hideSpinner(statsGrid, cards.map(c => `
      <div class="stat-card">
        <div class="stat-icon ${c.colour}"><i class="fas ${c.icon}"></i></div>
        <div class="stat-info">
          <span class="stat-value">${c.value}</span>
          <span class="stat-label">${c.label}</span>
        </div>
      </div>`).join(''));

    // Recent contributions table
    const recentEl = document.getElementById('recent-my-contributions');
    const recent   = [...myContributions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (recentEl) {
      if (!recent.length) {
        recentEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;padding:8px 0;">No contributions recorded yet.</p>';
      } else {
        const rows = recent.map((c, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(formatCurrency(c.amount))}</td>
            <td>${escapeHtml(formatDate(c.date))}</td>
            <td><span class="badge badge-success">Recorded</span></td>
          </tr>`).join('');
        recentEl.innerHTML = `
          <div class="table-wrapper">
            <table class="table">
              <thead><tr><th>#</th><th>Amount (₦)</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      }
    }

    // Latest activities — filter to this member, show last 10
    const myActivities = allActivities
      .filter(a => !a.memberId || String(a.memberId) === String(currentUser.id))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    renderActivityFeed(myActivities, 'user-latest-activities');

  } catch (err) {
    hideSpinner(statsGrid, '');
    showToast(`Error loading data: ${err.message}`, 'error');
  }
});
