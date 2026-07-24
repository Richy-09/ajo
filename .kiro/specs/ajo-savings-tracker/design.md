# Design Document

## Overview

The Ajo Savings Tracker is a multi-page, client-side web application built with vanilla HTML, CSS, and JavaScript. It communicates exclusively through a centralised API layer (`api.js`) with a JSON Server mock REST API running on port 3000. The application is fully responsive across four breakpoints and shares UI components (styles, toasts, spinners) via a single `utils.js` module.

---

## Architecture

### File Structure

```
ajo-savings/
├── db.json                  # JSON Server data store
├── index.html               # Landing page
├── dashboard.html           # Dashboard (stats, chart, activity)
├── members.html             # Members management
├── contributions.html       # Contributions management
├── payments.html            # Payments management
├── reports.html             # Reports (tabbed)
├── profile.html             # User profile
├── settings.html            # Settings
├── style.css                # Global styles and CSS custom properties
└── js/
    ├── api.js               # API Layer — all fetch() calls live here
    ├── utils.js             # Shared: toast, spinner, formatCurrency
    ├── dashboard.js         # Dashboard page logic
    ├── members.js           # Members page logic
    ├── contributions.js     # Contributions page logic
    ├── payments.js          # Payments page logic
    ├── reports.js           # Reports page logic
    ├── profile.js           # Profile page logic
    └── settings.js          # Settings page logic
```

### Layer Diagram

```
Page HTML  →  Page JS  →  api.js (fetch)  →  JSON Server (port 3000)
                ↓
            utils.js  (toast, spinner, formatCurrency)
                ↓
            style.css (shared CSS classes, CSS custom properties)
```

---

## Data Models

### Member
```json
{
  "id": "string",
  "name": "string",
  "phone": "string",
  "email": "string",
  "status": "Active | Inactive",
  "dateJoined": "YYYY-MM-DD",
  "contributionAmount": "number"
}
```

### Contribution
```json
{
  "id": "string",
  "memberId": "string",
  "memberName": "string",
  "amount": "number",
  "date": "YYYY-MM-DD"
}
```

### Payment
```json
{
  "id": "string",
  "memberId": "string",
  "memberName": "string",
  "amount": "number",
  "date": "YYYY-MM-DD",
  "status": "Paid | Pending"
}
```

### User (Profile)
```json
{
  "id": "string",
  "name": "string",
  "phone": "string",
  "email": "string",
  "password": "string",
  "photo": "string (URL or base64)",
  "groupName": "string",
  "memberSince": "YYYY-MM-DD"
}
```

### Activity Log (in-memory, not persisted)
```json
{
  "type": "created | updated | deleted",
  "resource": "member | contribution | payment",
  "description": "string",
  "timestamp": "ISO 8601 string"
}
```

> Activity log entries are stored in `sessionStorage` so the "Latest Activities" feed persists across page navigations within a session but resets on tab close.

---

## Component Design

### `api.js` — API Layer

All 12 exported functions follow this pattern:

```js
async function apiCall(method, path, body) {
  const res = await fetch(`http://localhost:3000${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// Members
export const getMembers        = ()       => apiCall('GET',    '/members');
export const addMember         = (data)   => apiCall('POST',   '/members', data);
export const updateMember      = (id, d)  => apiCall('PUT',    `/members/${id}`, d);
export const deleteMember      = (id)     => apiCall('DELETE', `/members/${id}`);

// Contributions
export const getContributions  = ()       => apiCall('GET',    '/contributions');
export const addContribution   = (data)   => apiCall('POST',   '/contributions', data);
export const updateContribution= (id, d)  => apiCall('PUT',    `/contributions/${id}`, d);
export const deleteContribution= (id)     => apiCall('DELETE', `/contributions/${id}`);

// Payments
export const getPayments       = ()       => apiCall('GET',    '/payments');
export const addPayment        = (data)   => apiCall('POST',   '/payments', data);
export const updatePayment     = (id, d)  => apiCall('PUT',    `/payments/${id}`, d);
export const deletePayment     = (id)     => apiCall('DELETE', `/payments/${id}`);
```

---

### `utils.js` — Shared Utilities

**Toast**: appended to a `#toast-container` div present in every page's HTML. Auto-dismissed after 3 seconds via `setTimeout`.

**Spinner**: replaces the `innerHTML` of a target container element with a spinner markup while loading; restored on completion.

**formatCurrency**: formats a number as `₦1,234,567`.

```js
export function showToast(message, type = 'success') { ... }  // type: 'success' | 'error'
export function showSpinner(container) { ... }
export function hideSpinner(container, html) { ... }
export function formatCurrency(amount) { ... }
export function logActivity(type, resource, description) { ... }
export function getActivities() { ... }
```

---

### Sidebar / Navigation

Every page (`dashboard.html` through `settings.html`) contains the same sidebar HTML block:

```html
<nav class="sidebar" id="sidebar">
  <div class="sidebar-logo">Ajo Savings</div>
  <ul class="nav-links">
    <li><a href="dashboard.html"      data-page="dashboard">      <i class="fas fa-tachometer-alt"></i> Dashboard</a></li>
    <li><a href="members.html"        data-page="members">        <i class="fas fa-users"></i> Members</a></li>
    <li><a href="contributions.html"  data-page="contributions">  <i class="fas fa-hand-holding-usd"></i> Contributions</a></li>
    <li><a href="payments.html"       data-page="payments">       <i class="fas fa-money-bill-wave"></i> Payments</a></li>
    <li><a href="reports.html"        data-page="reports">        <i class="fas fa-chart-bar"></i> Reports</a></li>
    <li><a href="profile.html"        data-page="profile">        <i class="fas fa-user"></i> Profile</a></li>
    <li><a href="settings.html"       data-page="settings">       <i class="fas fa-cog"></i> Settings</a></li>
  </ul>
</nav>
<button class="hamburger" id="hamburger"><i class="fas fa-bars"></i></button>
```

The page JS sets the active link by matching `data-page` against a `PAGE_ID` constant defined at the top of each script.

---

### Responsive Layout

Implemented entirely in CSS using media queries and CSS custom properties:

| Breakpoint       | Sidebar            | Stat Cards | Layout       |
|------------------|--------------------|------------|--------------|
| ≥ 1440px         | Full width (240px) | 4 per row  | Side-by-side |
| 1024–1439px      | Narrow (200px)     | 4 per row  | Side-by-side |
| 768–1023px       | Collapsed (overlay)| 2 per row  | Full-width   |
| < 480px          | Hidden (hamburger) | 1 per row  | Single column|

CSS custom properties defined in `:root`:
```css
:root {
  --sidebar-width: 240px;
  --sidebar-narrow: 200px;
  --primary:   #2563eb;
  --success:   #16a34a;
  --danger:    #dc2626;
  --warning:   #ea580c;
  --text:      #1e293b;
  --bg:        #f8fafc;
  --card-bg:   #ffffff;
  --border:    #e2e8f0;
  --radius:    8px;
  --shadow:    0 1px 3px rgba(0,0,0,0.1);
  --transition: 200ms ease;
}
```

---

## Page-by-Page Design

### `index.html` — Landing Page

- Full-viewport hero section, centred content.
- Group name heading, tagline "Building a Better Tomorrow", and a `.btn-primary` "View Dashboard" button that links to `dashboard.html`.
- No JS required; pure HTML/CSS.

---

### `dashboard.html` — Dashboard

**Sections:**
1. Four `Stat_Card` components in a responsive grid.
2. Chart.js line chart ("Savings Progress").
3. "Recent Contributions" panel (last 5 by date).
4. "Latest Activities" feed (last 5 from `sessionStorage`).

**Load sequence (`dashboard.js`):**
```
showSpinner(statsGrid)
  → Promise.all([getMembers(), getContributions(), getPayments()])
  → compute stats, render Stat_Cards
  → aggregate by month, render Chart
  → render Recent Contributions
  → render Latest Activities
hideSpinner()
```

**Chart data aggregation:**
- Group contributions by `YYYY-MM`, sum amounts → `contributionData[]`
- Group payments by `YYYY-MM`, sum amounts → `paymentData[]`
- Union of all month keys → `labels[]`

---

### `members.html` — Members

**Layout:** Split into a form panel (Add Member) and a table panel.

**Table columns:** Name, Phone, Contribution Amount, Status (Badge), Actions (Edit, Delete).

**Search:** `input[type=text]` — filters by `name` or `phone` on `keyup`.

**Pagination:** 4 rows per page; "Prev / Next" buttons; range label "1–4 of N".

**Add/Edit flow:**
- Edit pre-fills the form from the row's data attributes and switches the submit button label to "Update Member".
- Submit handler checks for duplicate name+phone via `getMembers()` before `POST`.
- Success → `showToast('✓ Member Added')` or `showToast('✓ Member Updated')`, reload table.

**Delete flow:** Confirmation `confirm()` dialog → `deleteMember(id)` → `showToast('✓ Deleted Successfully')`.

**Validation:**
- Name: required
- Phone: required, 10–15 digits
- Email: required
- Status: required
- Date Joined: required

---

### `contributions.html` — Contributions

**Layout:** Form panel (Record Contribution) + table panel.

**Member dropdown:** populated by `getMembers()` on page load; stores `memberId` and `memberName`.

**Table columns:** Member Name, Amount (₦), Date, Actions (Edit, Delete).

**Search + Sort:** search on `keyup`; sort `<select>` with options: Newest, Oldest, Highest Amount, Lowest Amount, Name A–Z, Name Z–A.

**Validation:**
- Member: required (must select from dropdown)
- Amount: required, > 0
- Date: required

---

### `payments.html` — Payments

**Layout:** Form panel (Add Payment) + table panel.

**Table columns:** Member Name, Amount (₦), Date, Status (Badge), Actions (Edit, Delete).

**Badges:** `status === 'Paid'` → `.badge-success` (green); `status === 'Pending'` → `.badge-warning` (orange).

**Search + Sort:** same pattern as contributions.

**Validation:**
- Member: required
- Amount: required, > 0
- Date: required
- Status: required

---

### `reports.html` — Reports

**Tabs:** Summary | Contributions | Payments | Members

Tab switching is handled in JS by showing/hiding `.tab-panel` elements; no page reload.

**Summary tab metrics (all computed):**
- Total Savings = sum of all payment amounts
- Total Contributions = sum of all contribution amounts
- Total Payments = sum of all payment amounts
- Outstanding Balance = Total Contributions − Total Payments
- Active Members = count of members with `status === 'Active'`
- Top Contributor = member name with highest sum of contributions

No input fields on this page.

---

### `profile.html` — Profile

**Display section:** Avatar `<img>`, Name, Phone, Group Name, Member Since.

**Edit form fields:** Photo (file input), Name, Phone, Email, Password.

**Validation:** Name and Email are required; inline error shown, request blocked if empty.

**Submit:** `updateUser(id, data)` → `showToast('✓ Profile Updated')`.

Avatar preview updates client-side using `FileReader` before submission.

---

### `settings.html` — Settings

**Sections:**
1. **Group Information** — display-only group name and creation date.
2. **Notifications** — toggle switches (UI only, persisted to `localStorage`).
3. **Change Password** — current password, new password, confirm; validated client-side.
4. **Backup Data** — fetches all collections from API, serialises to JSON, triggers download via `<a download>` with a `Blob` URL.
5. **Logout** — clears `localStorage` and `sessionStorage`, navigates to `index.html`.

---

## Shared CSS Patterns

### Button classes
```css
.btn-primary  { background: var(--primary);  color: #fff; ... }
.btn-danger   { background: var(--danger);   color: #fff; ... }
.btn-success  { background: var(--success);  color: #fff; ... }
```
All buttons share `border-radius: var(--radius)`, `transition: var(--transition)`, and hover/focus states.

### Table class
```css
.table { width: 100%; border-collapse: collapse; ... }
.table thead th { background: var(--bg); ... }
.table tbody tr:hover { transform: translateY(-1px); box-shadow: var(--shadow); transition: var(--transition); }
```

### Stat_Card pattern
```html
<div class="stat-card">
  <div class="stat-icon"><i class="fas fa-..."></i></div>
  <div class="stat-info">
    <span class="stat-value">₦0</span>
    <span class="stat-label">Label</span>
  </div>
</div>
```
Entry animation: `@keyframes fadeSlideUp` applied on page load.

### Form pattern
```html
<form class="form-panel">
  <div class="form-group">
    <label for="field">Label</label>
    <input id="field" class="form-control" type="text" required />
    <span class="field-error" id="field-error"></span>
  </div>
  <button type="submit" class="btn-primary">Submit</button>
</form>
```

### Badge pattern
```html
<span class="badge badge-success">Active</span>
<span class="badge badge-warning">Pending</span>
<span class="badge badge-danger">Inactive</span>
```

### Toast container (every page body)
```html
<div id="toast-container"></div>
```

---

## `db.json` Seed Structure

```json
{
  "members": [],
  "contributions": [],
  "payments": [],
  "users": [
    {
      "id": "1",
      "name": "Admin User",
      "phone": "08000000000",
      "email": "admin@ajosavings.com",
      "password": "admin123",
      "photo": "",
      "groupName": "Ajo Savings Group",
      "memberSince": "2024-01-01"
    }
  ]
}
```

---

## External Dependencies

| Library       | Version  | Source                        | Usage                        |
|---------------|----------|-------------------------------|------------------------------|
| JSON Server   | ^1.0.0   | npm                           | Mock REST API                |
| Chart.js      | ^4.x     | CDN (cdnjs)                   | Dashboard line chart         |
| Font Awesome  | 6.x      | CDN (cdnjs)                   | Icons throughout application |

No build tools, bundlers, or frameworks are used. All JS modules use native ES module `import`/`export` with `type="module"` script tags.
