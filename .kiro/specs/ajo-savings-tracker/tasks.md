# Implementation Plan: Ajo Savings Tracker

## Overview

Build the Ajo Savings Tracker as a multi-page HTML/CSS/JavaScript web application backed by a JSON Server mock REST API. Implementation proceeds bottom-up: shared infrastructure first (db.json, api.js, utils.js, style.css), then individual pages from simplest to most complex, ending with integration wiring and responsive polish.

---

## Tasks

- [x] 1. Set up project structure, data store, and shared infrastructure
  - Create the directory structure: `js/` folder and all HTML file placeholders
  - Create `db.json` with the seed data structure (empty `members`, `contributions`, `payments` arrays; one default admin `users` entry)
  - Add `package.json` with `json-server ^1.0.0` as a dev dependency and a `start` script: `json-server --watch db.json --port 3000`
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 2. Implement `api.js` — centralised API layer
  - [x] 2.1 Write the `apiCall` base function and all 12 exported CRUD functions for members, contributions, and payments
    - Implement `apiCall(method, path, body)` using `fetch()` targeting `http://localhost:3000`
    - Throw descriptive errors for non-2xx responses (include status code and response body)
    - Export: `getMembers`, `addMember`, `updateMember`, `deleteMember`, `getContributions`, `addContribution`, `updateContribution`, `deleteContribution`, `getPayments`, `addPayment`, `updatePayment`, `deletePayment`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.2 Write unit tests for `api.js`
    - Mock `fetch` and verify: correct URL construction, correct HTTP method, JSON body serialisation, error thrown on 4xx/5xx, error thrown on network failure
    - _Requirements: 4.3, 4.4_

- [x] 3. Implement `utils.js` — shared utilities
  - [x] 3.1 Implement `showToast`, `hideSpinner`/`showSpinner`, `formatCurrency`, `logActivity`, and `getActivities`
    - `showToast(message, type)`: append to `#toast-container`, auto-dismiss after 3 s via `setTimeout`; support `'success'` and `'error'` types
    - `showSpinner(container)` / `hideSpinner(container, html)`: replace/restore container innerHTML
    - `formatCurrency(amount)`: return `₦1,234,567` formatted string
    - `logActivity(type, resource, description)` / `getActivities()`: read/write activity entries to `sessionStorage`
    - _Requirements: 18.1, 18.3, 19.5, 8.2, 22.5_

  - [ ]* 3.2 Write unit tests for `utils.js`
    - Test `formatCurrency` with zero, whole numbers, decimals, and large values
    - Test `showToast` auto-dismiss timing (mock `setTimeout`)
    - Test `logActivity` / `getActivities` round-trip via a mocked `sessionStorage`
    - _Requirements: 6.3, 19.5_

- [x] 4. Implement global `style.css` — CSS custom properties, layout, and shared component classes
  - [x] 4.1 Define CSS custom properties, reset, and base typography
    - Declare all `:root` custom properties: `--sidebar-width`, `--sidebar-narrow`, `--primary`, `--success`, `--danger`, `--warning`, `--text`, `--bg`, `--card-bg`, `--border`, `--radius`, `--shadow`, `--transition`
    - Apply box-sizing reset and base `font-family`
    - _Requirements: 21.5, 22.1_

  - [x] 4.2 Implement sidebar, hamburger, and two-column page layout styles
    - `.sidebar` fixed/absolute positioning, full and narrow widths, z-index overlay behaviour
    - `.hamburger` button visibility rules
    - `.main-content` margin-left responsive to sidebar width
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.3 Implement responsive breakpoints for sidebar and stat-card grid
    - `≥1440px`: sidebar 240px, 4-column stat grid
    - `1024–1439px`: sidebar 200px, 4-column stat grid
    - `768–1023px`: sidebar collapsed (overlay), 2-column stat grid
    - `<480px`: sidebar hidden (hamburger only), single-column layout
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.4 Implement shared component CSS: buttons, tables, stat-cards, forms, badges, toasts, spinner, animations
    - `.btn-primary`, `.btn-danger`, `.btn-success` with hover/focus transitions ≤200ms
    - `.table` with `thead` background, `tbody tr:hover` lift effect
    - `.stat-card` grid item with `@keyframes fadeSlideUp` entry animation
    - `.form-panel`, `.form-group`, `.form-control`, `.field-error`
    - `.badge-success`, `.badge-warning`, `.badge-danger`
    - `.toast` (success/error variants), `#toast-container`
    - `.spinner` markup styles
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 22.1, 22.2, 22.3, 22.4_

- [x] 5. Implement `index.html` — Landing Page
  - Build full-viewport hero section with group name heading, tagline "Building a Better Tomorrow", and `.btn-primary` "View Dashboard" anchor linking to `dashboard.html`
  - Include `#toast-container` and Font Awesome CDN link
  - No JS module required
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 6. Implement `dashboard.html` and `dashboard.js`
  - [x] 6.1 Build `dashboard.html` page structure
    - Include shared sidebar HTML block with all nav links and `data-page="dashboard"`
    - Add `#stats-grid` container for four Stat_Cards
    - Add `<canvas id="savings-chart">` for Chart.js
    - Add "Recent Contributions" panel container and "Latest Activities" feed container
    - Include `#toast-container`, Font Awesome CDN, Chart.js CDN, and `<script type="module" src="js/dashboard.js">`
    - _Requirements: 6.1, 7.1, 8.1, 8.2, 2.1, 2.5_

  - [x] 6.2 Implement `dashboard.js` — stats, chart, and activity feed
    - On load: call `showSpinner(statsGrid)`, then `Promise.all([getMembers(), getContributions(), getPayments()])`
    - Compute and render four Stat_Cards: Total Savings, Total Contributions, Total Payments, Member count using `formatCurrency`
    - Aggregate contributions and payments by `YYYY-MM`, build Chart.js line chart with two series
    - Render "Recent Contributions" panel (last 5 by date): member name, formatted amount, date
    - Render "Latest Activities" feed (last 5 from `getActivities()`)
    - Set active nav link via `PAGE_ID = 'dashboard'`
    - Wire hamburger toggle
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 18.1, 18.3, 2.5_

- [x] 7. Implement `members.html` and `members.js`
  - [x] 7.1 Build `members.html` page structure
    - Shared sidebar, `#toast-container`, form panel (Add Member) with fields: Name, Phone, Email, Status select, Date Joined, and a `#member-submit` button
    - Table panel with `<input type="text" id="member-search">`, `<table class="table">` with columns: Name, Phone, Contribution Amount, Status Badge, Actions
    - Pagination controls: Prev button, range label, Next button
    - `<script type="module" src="js/members.js">`
    - _Requirements: 9.1, 10.1, 10.2, 2.1_

  - [x] 7.2 Implement `members.js` — CRUD, search, and pagination
    - On load: `getMembers()` → render table with pagination (4 rows/page)
    - Add Member form submit: validate (name required, phone 10–15 digits, email required, status required, date required), duplicate name+phone check via `getMembers()`, `addMember(data)`, `showToast('✓ Member Added')`, `logActivity`, reload table
    - Edit: pre-fill form from row data attributes, change button label to "Update Member", `updateMember(id, data)`, `showToast('✓ Member Updated')`, `logActivity`, reload table
    - Delete: `confirm()` dialog → `deleteMember(id)` → `showToast('✓ Deleted Successfully')` → `logActivity` → reload table
    - Search: `keyup` on `#member-search` → filter by name or phone → re-render table
    - Pagination: Prev/Next buttons update current page, re-render table
    - Disable submit button during in-flight requests
    - Set `PAGE_ID = 'members'`, wire hamburger
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 17.1, 17.2, 17.4, 18.2, 19.1, 19.4, 19.6_

  - [ ]* 7.3 Write unit tests for `members.js` validation logic
    - Test phone validation: accepts 10–15 digit strings, rejects shorter/longer/non-numeric
    - Test duplicate detection: mock `getMembers` to return existing entry, assert form blocked
    - _Requirements: 17.2, 17.4_

- [ ] 8. Implement `contributions.html` and `contributions.js`
  - [x] 8.1 Build `contributions.html` page structure
    - Shared sidebar, `#toast-container`
    - Form panel (Record Contribution): Member `<select id="member-select">`, Amount input, Date input, submit button
    - Table panel: search input, sort `<select>`, `.table` with columns: Member Name, Amount (₦), Date, Actions
    - `<script type="module" src="js/contributions.js">`
    - _Requirements: 11.1, 11.3, 12.1, 12.2, 2.1_

  - [ ] 8.2 Implement `contributions.js` — CRUD, member dropdown, search, and sort
    - On load: `Promise.all([getMembers(), getContributions()])` → populate member dropdown, render table
    - Record Contribution submit: validate (member required, amount > 0, date required), `addContribution(data)`, `showToast('✓ Contribution Recorded')`, `logActivity`, reload table
    - Edit: pre-fill form, `updateContribution(id, data)`, `showToast('✓ Contribution Updated')`, `logActivity`, reload table
    - Delete: confirm → `deleteContribution(id)` → `showToast('✓ Deleted Successfully')` → `logActivity` → reload
    - Search: `keyup` filter on member name, amount, or date
    - Sort: reorder array by selected option (Newest, Oldest, Highest Amount, Lowest Amount, Name A–Z, Name Z–A)
    - Disable submit during requests; `PAGE_ID = 'contributions'`; wire hamburger
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.2, 17.1, 17.3, 18.2, 19.2, 19.4, 19.6, 20.1, 20.2_

- [ ] 9. Implement `payments.html` and `payments.js`
  - [x] 9.1 Build `payments.html` page structure
    - Shared sidebar, `#toast-container`
    - Form panel (Add Payment): Member select, Amount input, Date input, Status select (Paid/Pending), submit button
    - Table panel: search input, sort select, `.table` with columns: Member Name, Amount (₦), Date, Status Badge, Actions
    - `<script type="module" src="js/payments.js">`
    - _Requirements: 13.1, 13.2, 2.1_

  - [ ] 9.2 Implement `payments.js` — CRUD, badges, search, and sort
    - On load: `Promise.all([getMembers(), getPayments()])` → populate member dropdown, render table
    - Render Status badges: `'Paid'` → `.badge-success`, `'Pending'` → `.badge-warning`
    - Add Payment submit: validate (member, amount > 0, date, status required), `addPayment(data)`, `showToast('✓ Payment Added')`, `logActivity`, reload
    - Edit: pre-fill form, `updatePayment(id, data)`, `showToast('✓ Payment Updated')`, `logActivity`, reload
    - Delete: confirm → `deletePayment(id)` → `showToast('✓ Deleted Successfully')` → `logActivity` → reload
    - Search and sort: same pattern as contributions
    - Disable submit during requests; `PAGE_ID = 'payments'`; wire hamburger
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 17.1, 17.3, 18.2, 19.3, 19.4, 19.6, 20.1, 20.2_

- [ ] 10. Checkpoint — ensure core CRUD pages function end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement `reports.html` and `reports.js`
  - [x] 11.1 Build `reports.html` page structure
    - Shared sidebar, `#toast-container`
    - Tab bar with four tabs: Summary, Contributions, Payments, Members (each a `<button data-tab="...">`)
    - Four `.tab-panel` divs (one per tab), initially only Summary visible
    - `<script type="module" src="js/reports.js">`
    - _Requirements: 14.1, 2.1_

  - [ ] 11.2 Implement `reports.js` — computed metrics and tab switching
    - On load: `Promise.all([getMembers(), getContributions(), getPayments()])` → compute all metrics
    - Summary tab: render Total Savings, Total Contributions, Total Payments, Outstanding Balance (Contributions − Payments), Active Members count, Top Contributor name
    - Contributions tab: render full contributions table (read-only, no forms)
    - Payments tab: render full payments table (read-only)
    - Members tab: render full members table (read-only)
    - Tab switching: show active `.tab-panel`, hide others, update active tab button style — no page reload
    - No manual input fields; all values derived from API data
    - `PAGE_ID = 'reports'`; wire hamburger
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 12. Implement `profile.html` and `profile.js`
  - [x] 12.1 Build `profile.html` page structure
    - Shared sidebar, `#toast-container`
    - Display section: `<img id="avatar">`, Name, Phone, Group name, Member Since
    - Edit form: Photo file input, Name, Phone, Email, Password, submit button; inline `.field-error` spans for Name and Email
    - `<script type="module" src="js/profile.js">`
    - _Requirements: 15.1, 2.1_

  - [ ] 12.2 Implement `profile.js` — display, edit, and avatar preview
    - On load: fetch user from API (`GET /users/1`), populate display section and pre-fill form fields
    - Avatar preview: `FileReader` on file input `change` → update `<img>` src client-side before submission
    - Submit: validate Name and Email required (show `.field-error`, block request if empty), `updateUser(id, data)`, `showToast('✓ Profile Updated')`, reload display
    - Disable submit during request; `PAGE_ID = 'profile'`; wire hamburger
    - Note: add `getUser` / `updateUser` exports to `api.js` targeting `/users/:id`
    - _Requirements: 15.1, 15.2, 15.3, 4.1, 17.1, 18.2, 19.6_

- [ ] 13. Implement `settings.html` and `settings.js`
  - [x] 13.1 Build `settings.html` page structure
    - Shared sidebar, `#toast-container`
    - Group Information section: display-only group name and creation date
    - Notifications section: toggle switches for at least two notification types
    - Change Password section: Current Password, New Password, Confirm Password inputs and submit button
    - Backup Data section: "Download Backup" button
    - Logout section: "Logout" button
    - `<script type="module" src="js/settings.js">`
    - _Requirements: 16.1, 2.1_

  - [ ] 13.2 Implement `settings.js` — notifications, password change, backup, and logout
    - On load: read notification toggle states from `localStorage`, apply to toggle switches
    - Notification toggles: on `change`, persist state to `localStorage`
    - Change Password: validate current password (client-side check against stored value), new password and confirm must match; show inline error if validation fails
    - Backup Data: `Promise.all([getMembers(), getContributions(), getPayments()])` → serialize to JSON → create `Blob` → trigger `<a download="ajo-backup.json">` click
    - Logout: `localStorage.clear()`, `sessionStorage.clear()`, navigate to `index.html`
    - `PAGE_ID = 'settings'`; wire hamburger
    - _Requirements: 16.1, 16.2, 16.3_

- [ ] 14. Checkpoint — ensure all pages render and navigate correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Wire active navigation and hamburger toggle across all pages
  - [ ] 15.1 Verify and fix active nav link highlighting on every page
    - Each page JS sets the active class on the correct sidebar `<a>` element by matching `PAGE_ID` to `data-page` attribute
    - _Requirements: 2.5_

  - [ ] 15.2 Implement and verify hamburger toggle behaviour
    - Hamburger `click` → toggle `.open` class on `.sidebar`
    - Clicking a nav link or outside the sidebar on mobile closes the sidebar
    - _Requirements: 2.3, 2.4_

- [ ] 16. Final validation: form validation, loading states, and toast coverage
  - [ ] 16.1 Audit all forms for complete validation and loading-state coverage
    - Every required field shows `.field-error` and blocks submission when empty
    - Phone 10–15 digit rule enforced on member forms
    - Amount > 0 enforced on contribution and payment forms
    - Duplicate name+phone detection on Add Member
    - Submit button disabled during in-flight requests and re-enabled on completion
    - Spinner shown while data loads, removed when data renders
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 18.1, 18.2, 18.3_

  - [ ] 16.2 Audit all toast messages for correct wording and error-case coverage
    - Confirm: "✓ Member Added", "✓ Contribution Recorded", "✓ Payment Updated", "✓ Deleted Successfully"
    - Confirm error toasts fire on any API_Layer rejection
    - Confirm all toasts auto-dismiss after 3 s
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

- [ ] 17. Final checkpoint — full test pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery.
- No build tools or bundlers are used; all scripts use native ES module `import`/`export` with `type="module"`.
- JSON Server must be running (`npm start`) before opening any page in a browser.
- The `getUser` and `updateUser` functions for `/users/:id` should be added to `api.js` as part of task 12.2.
- Activity log entries are stored in `sessionStorage` — they persist across page navigations within a session but reset when the tab is closed.
- Property-based tests are not applicable to this project (no Correctness Properties section in the design).

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 1, "tasks": ["2.2", "3.2", "4.2"] },
    { "id": 2, "tasks": ["4.3", "4.4"] },
    { "id": 3, "tasks": ["6.1", "7.1", "8.1", "9.1", "11.1", "12.1", "13.1"] },
    { "id": 4, "tasks": ["6.2", "7.2", "8.2", "9.2", "11.2", "12.2", "13.2"] },
    { "id": 5, "tasks": ["7.3", "15.1", "15.2"] },
    { "id": 6, "tasks": ["16.1", "16.2"] }
  ]
}
```
