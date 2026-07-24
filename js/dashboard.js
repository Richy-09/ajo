/**
 * dashboard.js — Dashboard page logic
 *
 * Responsibilities:
 *  - Set active nav link
 *  - Wire hamburger toggle
 *  - Fetch members, contributions, and payments in parallel
 *  - Render 4 stat cards
 *  - Render Chart.js savings-progress line chart (contributions vs payments by month)
 *  - Render "Recent Contributions" panel (last 5 by date)
 *  - Render "Latest Activities" feed (last 5 from sessionStorage)
 */

import { getMembers, getContributions, getPayments, getActivities as fetchActivities } from './api.js';
import { showToast, showSpinner, hideSpinner, formatCurrency } from './utils.js';
import { requireAdmin } from './auth.js';

const PAGE_ID = 'dashboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Aggregates an array of records into a month-keyed total map.
 *
 * @param {Array<{date: string, amount: number}>} records
 * @returns {Object.<string, number>} e.g. { '2024-01': 5000, '2024-02': 8000 }
 */
function aggregateByMonth(records) {
  return records.reduce((acc, record) => {
    const month = String(record.date || '').slice(0, 7); // 'YYYY-MM'
    if (!month) return acc;
    acc[month] = (acc[month] || 0) + Number(record.amount || 0);
    return acc;
  }, {});
}

/**
 * Returns a sorted array of unique month strings from two month-key objects.
 *
 * @param {Object.<string, number>} mapA
 * @param {Object.<string, number>} mapB
 * @returns {string[]} Sorted 'YYYY-MM' labels
 */
function buildMonthLabels(mapA, mapB) {
  const all = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
  return [...all].sort();
}

/**
 * Formats a 'YYYY-MM' string to a human-readable label, e.g. 'Jan 2024'.
 *
 * @param {string} yyyyMM
 * @returns {string}
 */
function formatMonthLabel(yyyyMM) {
  const [year, month] = yyyyMM.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-NG', { month: 'short', year: 'numeric' });
}

/**
 * Formats a 'YYYY-MM-DD' date string into a readable short date.
 *
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Returns a human-readable relative time string for an ISO 8601 timestamp.
 *
 * @param {string} isoTimestamp
 * @returns {string}
 */
function timeAgo(isoTimestamp) {
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Render functions
// ---------------------------------------------------------------------------

/**
 * Builds and returns the HTML string for the 4 stat cards.
 *
 * @param {number} totalSavings
 * @param {number} totalContributions
 * @param {number} totalPayments
 * @param {number} memberCount
 * @returns {string}
 */
function buildStatCardsHTML(totalSavings, totalContributions, totalPayments, memberCount) {
  const cards = [
    {
      colour: 'blue',
      icon:   'fa-piggy-bank',
      value:  formatCurrency(totalSavings),
      label:  'Total Savings',
    },
    {
      colour: 'green',
      icon:   'fa-hand-holding-usd',
      value:  formatCurrency(totalContributions),
      label:  'Total Contributions',
    },
    {
      colour: 'orange',
      icon:   'fa-money-bill-wave',
      value:  formatCurrency(totalPayments),
      label:  'Total Payments',
    },
    {
      colour: 'purple',
      icon:   'fa-users',
      value:  String(memberCount),
      label:  'Members',
    },
  ];

  return cards.map(({ colour, icon, value, label }) => `
    <div class="stat-card">
      <div class="stat-icon ${colour}">
        <i class="fas ${icon}"></i>
      </div>
      <div class="stat-info">
        <span class="stat-value">${value}</span>
        <span class="stat-label">${label}</span>
      </div>
    </div>
  `).join('');
}

/**
 * Renders the Chart.js line chart on the #savings-chart canvas.
 *
 * @param {string[]} labels    Sorted 'YYYY-MM' month labels
 * @param {Object.<string, number>} contributionMap
 * @param {Object.<string, number>} paymentMap
 */
function renderChart(labels, contributionMap, paymentMap) {
  const canvas = document.getElementById('savings-chart');
  if (!canvas) return;

  // If no data at all, show a placeholder message
  if (labels.length === 0) {
    const parent = canvas.parentElement;
    if (parent) {
      parent.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.875rem;gap:8px;">
          <i class="fas fa-chart-line" style="font-size:1.25rem;opacity:0.3;"></i>
          No contribution or payment data yet — chart will appear once records are added.
        </div>`;
    }
    return;
  }

  const readableLabels   = labels.map(formatMonthLabel);
  const contributionData = labels.map(m => contributionMap[m] || 0);
  const paymentData      = labels.map(m => paymentMap[m] || 0);

  // Destroy existing chart instance to avoid double-render
  if (canvas._chartInstance) {
    canvas._chartInstance.destroy();
  }

  canvas._chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: readableLabels,
      datasets: [
        {
          label:            'Contributions',
          data:             contributionData,
          borderColor:      '#4f46e5',
          backgroundColor:  'rgba(79,70,229,0.08)',
          borderWidth:      2.5,
          pointRadius:      4,
          pointHoverRadius: 6,
          tension:          0.4,
          fill:             true,
        },
        {
          label:            'Payments',
          data:             paymentData,
          borderColor:      '#ea580c',
          backgroundColor:  'rgba(234,88,12,0.08)',
          borderWidth:      2.5,
          pointRadius:      4,
          pointHoverRadius: 6,
          tension:          0.4,
          fill:             true,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels:   { font: { size: 13 }, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid:  { display: false },
          ticks: { font: { size: 12 } },
        },
        y: {
          beginAtZero: true,
          ticks: {
            font:     { size: 12 },
            callback: (value) => formatCurrency(value),
          },
        },
      },
    },
  });
}

/**
 * Builds the HTML for the "Recent Contributions" panel body.
 *
 * @param {Array<{memberName: string, amount: number, date: string}>} contributions
 * @returns {string}
 */
function buildRecentContributionsHTML(contributions) {
  // Sort by date descending, take last 5
  const recent = [...contributions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (recent.length === 0) {
    return '<p style="color:#64748b; font-size:0.875rem;">No contributions recorded yet.</p>';
  }

  const rows = recent.map(c => `
    <tr>
      <td>${c.memberName || '—'}</td>
      <td>${formatCurrency(c.amount)}</td>
      <td>${formatDate(c.date)}</td>
    </tr>
  `).join('');

  return `
    <table class="table" style="margin-top:0;">
      <thead>
        <tr>
          <th>Member</th>
          <th>Amount</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Returns the Font Awesome icon class and colour for an activity entry.
 *
 * @param {{ type: string, resource: string }} activity
 * @returns {{ icon: string, colour: string }}
 */
function activityMeta(activity) {
  const resourceIconMap = {
    member:       { icon: 'fa-user',              colour: '#7c3aed' },
    contribution: { icon: 'fa-hand-holding-usd',  colour: '#16a34a' },
    payment:      { icon: 'fa-money-bill-wave',   colour: '#ea580c' },
  };
  const typeColourMap = {
    created: '#16a34a',
    updated: '#2563eb',
    deleted: '#dc2626',
  };

  const meta = resourceIconMap[activity.resource] || { icon: 'fa-bolt', colour: '#64748b' };
  const colour = typeColourMap[activity.type] || meta.colour;
  return { icon: meta.icon, colour };
}

/**
 * Builds the HTML for the "Latest Activities" feed body.
 *
 * @param {Array<{type: string, resource: string, description: string, timestamp: string}>} activities
 * @returns {string}
 */
function buildActivitiesHTML(activities) {
  const latest = activities.slice(0, 5);

  if (latest.length === 0) {
    return '<p style="color:#64748b; font-size:0.875rem;">No recent activity.</p>';
  }

  const items = latest.map(activity => {
    const { icon, colour } = activityMeta(activity);
    return `
      <div style="display:flex; align-items:flex-start; gap:12px; padding:10px 0; border-bottom:1px solid var(--border);">
        <div style="
          width:36px; height:36px; border-radius:50%;
          background:${colour}18;
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0; font-size:0.9rem; color:${colour};
        ">
          <i class="fas ${icon}"></i>
        </div>
        <div style="flex:1; min-width:0;">
          <p style="font-size:0.875rem; margin:0; line-height:1.4;">${activity.description}</p>
          <span style="font-size:0.75rem; color:#94a3b8;">${timeAgo(activity.timestamp)}</span>
        </div>
      </div>
    `;
  }).join('');

  return `<div style="margin-top:-4px;">${items}</div>`;
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
  // 1. Guard — redirect to login if not admin
  if (!requireAdmin()) return;

  // 2. Init nav (active link + hamburger/overlay wiring)
  initNav(PAGE_ID);

  // 2. Show spinner in stats grid while loading
  const statsGrid = document.getElementById('stats-grid');
  showSpinner(statsGrid);

  // 4. Fetch all data in parallel
  Promise.all([getMembers(), getContributions(), getPayments()])
    .then(async ([members, contributions, payments]) => {

      // 4a. Compute stats
      const totalContributions = contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const totalPayments      = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalSavings       = totalPayments; // Total Savings = sum of all Payments (per design)
      const memberCount        = members.length;

      // 4b. Render stat cards
      hideSpinner(statsGrid, buildStatCardsHTML(totalSavings, totalContributions, totalPayments, memberCount));

      // 4c. Aggregate by month and render chart
      const contributionMap = aggregateByMonth(contributions);
      const paymentMap      = aggregateByMonth(payments);
      const monthLabels     = buildMonthLabels(contributionMap, paymentMap);
      renderChart(monthLabels, contributionMap, paymentMap);

      // 4d. Render recent contributions panel
      const recentContribEl = document.getElementById('recent-contributions');
      if (recentContribEl) {
        // Preserve the heading that's already in the HTML, append the list below it
        const heading = recentContribEl.querySelector('h2');
        const listContainer = document.createElement('div');
        listContainer.innerHTML = buildRecentContributionsHTML(contributions);
        // Remove any previously injected content (everything after the heading)
        while (recentContribEl.children.length > 1) {
          recentContribEl.removeChild(recentContribEl.lastChild);
        }
        recentContribEl.appendChild(listContainer);
      }

      // 4e. Render latest activities feed — from API
      const activitiesEl = document.getElementById('latest-activities');
      if (activitiesEl) {
        try {
          const allActivities = await fetchActivities();
          // Sort newest first, take last 10
          const recent = [...allActivities]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);
          const feedContainer = document.createElement('div');
          feedContainer.innerHTML = buildActivitiesHTML(recent);
          while (activitiesEl.children.length > 1) {
            activitiesEl.removeChild(activitiesEl.lastChild);
          }
          activitiesEl.appendChild(feedContainer);
        } catch {
          // Fallback: show empty feed if API fails
          const feedContainer = document.createElement('div');
          feedContainer.innerHTML = buildActivitiesHTML([]);
          while (activitiesEl.children.length > 1) {
            activitiesEl.removeChild(activitiesEl.lastChild);
          }
          activitiesEl.appendChild(feedContainer);
        }
      }
    })
    .catch((error) => {
      // 5. On any error: show error toast and clear the spinner
      hideSpinner(statsGrid, '');
      showToast(error.message, 'error');
    });
});
