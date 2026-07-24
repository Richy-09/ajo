import { requireMember, logout, getSession, saveSession } from './auth.js';
import { getContributions, addContribution, updateMember } from './api.js';
import { showToast, showSpinner, hideSpinner, formatCurrency, logActivity } from './utils.js';

const PAGE_ID = 'user-contributions';
const BASE_URL = 'http://localhost:3000';

let currentUser       = null;
let memberData        = null;
let allMyContributions = [];

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

/** Add months to a YYYY-MM-DD date string, return YYYY-MM-DD. */
function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Days remaining until a date. Negative = past. */
function daysUntil(dateStr) {
  const target = new Date(dateStr);
  const now    = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / 86400000);
}

// ── Fetch member data ─────────────────────────────────────────
async function fetchMember() {
  const res = await fetch(`${BASE_URL}/members/${currentUser.id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Savings Plan Display ──────────────────────────────────────
function renderPlanDisplay(member) {
  const el = document.getElementById('plan-display');
  if (!el) return;

  if (!member.savingsDuration || !member.savingsStartDate) {
    el.innerHTML = `
      <div style="padding:16px;background:var(--bg);border-radius:var(--radius);border:1.5px dashed var(--border);text-align:center;">
        <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:12px;">
          <i class="fas fa-info-circle" style="margin-right:6px;color:var(--primary);"></i>
          You haven't set up a savings plan yet. Set one to track your progress and unlock payment requests.
        </p>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('edit-plan-btn').click()">
          <i class="fas fa-plus"></i> Set Up My Plan
        </button>
      </div>`;
    return;
  }

  const endDate   = addMonths(member.savingsStartDate, member.savingsDuration);
  const remaining = daysUntil(endDate);
  const matured   = remaining <= 0;
  const isFlexible = member.withdrawalType === 'flexible';

  // Progress
  const totalDays   = daysUntil(endDate) + (new Date() - new Date(member.savingsStartDate)) / 86400000;
  const elapsedDays = totalDays - Math.max(remaining, 0);
  const progress    = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  const statusColour = (matured || isFlexible) ? 'var(--success)' : 'var(--primary)';

  let statusText;
  if (isFlexible) {
    statusText = `<span style="color:var(--success);font-weight:600;"><i class="fas fa-check-circle"></i> Flexible plan — you can request payment any time.</span>`;
  } else if (matured) {
    statusText = `<span style="color:var(--success);font-weight:600;"><i class="fas fa-check-circle"></i> Plan matured — you can now request payment!</span>`;
  } else {
    statusText = `<span style="color:var(--primary);font-weight:600;"><i class="fas fa-clock"></i> ${remaining} days remaining until withdrawal</span>`;
  }

  // Withdrawal type badge
  const typeBadge = isFlexible
    ? `<span class="badge badge-success" style="font-size:0.7rem;"><i class="fas fa-calendar-check" style="margin-right:3px;"></i>Flexible Withdrawal</span>`
    : `<span class="badge" style="background:var(--primary-faint);color:var(--primary);font-size:0.7rem;"><i class="fas fa-lock" style="margin-right:3px;"></i>Fixed Withdrawal</span>`;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:20px;">
      <div style="background:var(--bg);border-radius:var(--radius);padding:14px;text-align:center;">
        <div style="font-size:1.4rem;font-weight:800;color:var(--primary);">${member.savingsDuration}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Month Plan</div>
      </div>
      <div style="background:var(--bg);border-radius:var(--radius);padding:14px;text-align:center;">
        <div style="font-size:1rem;font-weight:700;color:var(--text);">${formatDate(member.savingsStartDate)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Start Date</div>
      </div>
      <div style="background:var(--bg);border-radius:var(--radius);padding:14px;text-align:center;">
        <div style="font-size:1rem;font-weight:700;color:${matured ? 'var(--success)' : 'var(--text)'};">${formatDate(endDate)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">End Date</div>
      </div>
      <div style="background:var(--bg);border-radius:var(--radius);padding:14px;text-align:center;display:flex;align-items:center;justify-content:center;">
        ${typeBadge}
      </div>
    </div>

    <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:0.8rem;color:var(--text-muted);">Plan Progress</span>
      <span style="font-size:0.8rem;font-weight:600;color:${statusColour};">${progress}%</span>
    </div>
    <div style="height:8px;background:var(--border);border-radius:9999px;overflow:hidden;margin-bottom:12px;">
      <div style="width:${progress}%;height:100%;background:${statusColour};border-radius:9999px;transition:width 0.6s ease;"></div>
    </div>
    <div style="font-size:0.875rem;">${statusText}</div>`;
}

// ── Plan form ─────────────────────────────────────────────────
function showPlanForm(hasPlan) {
  document.getElementById('plan-display').style.display    = 'none';
  document.getElementById('plan-form-wrap').style.display  = 'block';
  document.getElementById('edit-plan-btn').style.display   = 'none';
  if (hasPlan) document.getElementById('plan-cancel').style.display = 'inline-flex';

  // Pre-fill if editing
  if (memberData?.savingsDuration) {
    document.getElementById('plan-duration').value = memberData.savingsDuration;
    document.getElementById('plan-start').value    = memberData.savingsStartDate || '';

    // Pre-select the withdrawal type radio
    const typeInput = document.getElementById(
      memberData.withdrawalType === 'flexible' ? 'type-flexible' : 'type-fixed'
    );
    if (typeInput) typeInput.checked = true;
  } else {
    // Default start date to today
    document.getElementById('plan-start').value = new Date().toISOString().slice(0, 10);
  }
}

function hidePlanForm() {
  document.getElementById('plan-display').style.display    = 'block';
  document.getElementById('plan-form-wrap').style.display  = 'none';
  document.getElementById('edit-plan-btn').style.display   = 'inline-flex';
}

async function handlePlanSubmit(e) {
  e.preventDefault();

  const duration       = document.getElementById('plan-duration')?.value;
  const start          = document.getElementById('plan-start')?.value;
  const withdrawalType = document.querySelector('input[name="withdrawal-type"]:checked')?.value;

  let hasError = false;
  ['plan-duration-error', 'plan-start-error', 'plan-type-error'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '';
  });
  ['plan-duration', 'plan-start'].forEach(id => document.getElementById(id)?.classList.remove('invalid'));

  if (!withdrawalType) {
    const el = document.getElementById('plan-type-error');
    if (el) el.textContent = 'Please select a withdrawal type.';
    hasError = true;
  }
  if (!duration) {
    const el = document.getElementById('plan-duration-error');
    if (el) el.textContent = 'Please select a duration.';
    document.getElementById('plan-duration')?.classList.add('invalid');
    hasError = true;
  }
  if (!start) {
    const el = document.getElementById('plan-start-error');
    if (el) el.textContent = 'Please pick a start date.';
    document.getElementById('plan-start')?.classList.add('invalid');
    hasError = true;
  }
  if (hasError) return;

  const btn = document.getElementById('plan-submit');
  if (btn) btn.disabled = true;

  try {
    const updated = {
      ...memberData,
      savingsDuration:  Number(duration),
      savingsStartDate: start,
      withdrawalType,   // 'fixed' or 'flexible'
    };
    await updateMember(currentUser.id, updated);
    memberData = updated;
    showToast('✓ Savings plan saved!');
    hidePlanForm();
    renderPlanDisplay(memberData);
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Contribution form ─────────────────────────────────────────
async function handleContribSubmit(e) {
  e.preventDefault();

  ['contrib-amount-error','contrib-date-error'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
  ['contrib-amount','contrib-date'].forEach(id => document.getElementById(id)?.classList.remove('invalid'));

  const amount = document.getElementById('contrib-amount')?.value;
  const date   = document.getElementById('contrib-date')?.value;

  let hasError = false;
  if (!amount || Number(amount) <= 0) {
    document.getElementById('contrib-amount')?.classList.add('invalid');
    const el = document.getElementById('contrib-amount-error'); if (el) el.textContent = 'Enter a valid amount.';
    hasError = true;
  }
  if (!date) {
    document.getElementById('contrib-date')?.classList.add('invalid');
    const el = document.getElementById('contrib-date-error'); if (el) el.textContent = 'Please select a date.';
    hasError = true;
  }
  if (hasError) return;

  const btn = document.getElementById('contrib-submit');
  if (btn) btn.disabled = true;

  try {
    await addContribution({
      memberId:   String(currentUser.id),
      memberName: currentUser.name,
      amount:     Number(amount),
      date,
    });
    logActivity('created', 'contribution',
      `${currentUser.name} contributed ${formatCurrency(Number(amount))}`,
      currentUser.id, currentUser.name);
    showToast('✓ Contribution added!');
    document.getElementById('contrib-form')?.reset();
    // Default date back to today
    document.getElementById('contrib-date').value = new Date().toISOString().slice(0, 10);
    await loadContributions();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Contribution table ────────────────────────────────────────
function applyFilter() {
  const query   = (document.getElementById('contrib-search')?.value ?? '').trim().toLowerCase();
  const sortVal = document.getElementById('contrib-sort')?.value ?? 'newest';

  let result = allMyContributions.filter(c =>
    !query || String(c.amount).includes(query) || (c.date ?? '').includes(query)
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

function renderContributions() {
  const tbody   = document.getElementById('my-contributions-tbody');
  const totalEl = document.getElementById('contrib-total');
  if (!tbody) return;

  const total = allMyContributions.reduce((s, c) => s + Number(c.amount || 0), 0);
  if (totalEl) totalEl.textContent = `Total: ${formatCurrency(total)}`;

  const rows = applyFilter();
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted);">No contributions yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(formatCurrency(c.amount))}</strong></td>
      <td>${escapeHtml(formatDate(c.date))}</td>
      <td><span class="badge badge-success">Recorded</span></td>
    </tr>`).join('');
}

async function loadContributions() {
  const all = await getContributions();
  allMyContributions = all.filter(c => String(c.memberId) === String(currentUser.id));
  renderContributions();
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = requireMember();
  if (!currentUser) return;

  initNav();

  // Default contribution date to today
  const contribDateEl = document.getElementById('contrib-date');
  if (contribDateEl) contribDateEl.value = new Date().toISOString().slice(0, 10);

  try {
    memberData = await fetchMember();
    const hasPlan = !!(memberData.savingsDuration && memberData.savingsStartDate);

    if (hasPlan) {
      renderPlanDisplay(memberData);
    } else {
      // Auto-show the plan form if no plan exists
      showPlanForm(false);
    }

    await loadContributions();
  } catch (err) {
    showToast(`Error loading data: ${err.message}`, 'error');
  }

  // Wire plan edit
  document.getElementById('edit-plan-btn')?.addEventListener('click', () => showPlanForm(true));
  document.getElementById('plan-cancel')?.addEventListener('click', hidePlanForm);
  document.getElementById('plan-form')?.addEventListener('submit', handlePlanSubmit);

  // Wire contribution form
  document.getElementById('contrib-form')?.addEventListener('submit', handleContribSubmit);

  // Wire search + sort
  document.getElementById('contrib-search')?.addEventListener('keyup', renderContributions);
  document.getElementById('contrib-sort')?.addEventListener('change', renderContributions);
});
