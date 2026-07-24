# Requirements Document

## Introduction

The Ajo Savings Tracker is a web-based contribution management dashboard for savings groups (Ajo). The application enables group administrators to manage members, record contributions, track payments, view reports, and monitor savings progress. It is built as a multi-page HTML/CSS/JavaScript application backed by a JSON Server mock REST API, and is fully responsive across desktop, laptop, tablet, and mobile breakpoints.

---

## Glossary

- **Ajo**: A rotating savings group where members contribute money at regular intervals.
- **Application**: The Ajo Savings Tracker web application as a whole.
- **API_Layer**: The `api.js` module that centralises all HTTP requests to the JSON Server.
- **JSON_Server**: The mock REST API running on port 3000, backed by `db.json`.
- **Dashboard**: The `dashboard.html` page showing aggregated savings statistics and charts.
- **Member**: A registered participant in the Ajo savings group.
- **Contribution**: A recorded deposit made by a Member.
- **Payment**: A recorded disbursement made to a Member.
- **Toast**: A brief, auto-dismissing notification message shown to the user.
- **Spinner**: A loading indicator displayed while an asynchronous operation is in progress.
- **Stat_Card**: A reusable UI component that displays a single aggregated metric.
- **Chart**: A Chart.js line chart rendered on the Dashboard showing savings trends.
- **Table**: A styled HTML table used to display lists of Members, Contributions, or Payments.
- **Badge**: A coloured inline label indicating the status of a Member or Payment.
- **Sidebar**: The persistent navigation panel displayed on desktop and laptop viewports.
- **Hamburger_Menu**: The collapsed navigation toggle displayed on tablet and mobile viewports.

---

## Requirements

---

### Requirement 1: Landing Page

**User Story:** As a visitor, I want to see a branded landing page, so that I understand the purpose of the application before entering the Dashboard.

#### Acceptance Criteria

1. THE Application SHALL display `index.html` as the default entry point.
2. THE Application SHALL render a hero section containing the group name, tagline "Building a Better Tomorrow", and a "View Dashboard" call-to-action button.
3. WHEN the user clicks the "View Dashboard" button, THE Application SHALL navigate to `dashboard.html`.

---

### Requirement 2: Navigation and Layout

**User Story:** As a user, I want consistent navigation across all pages, so that I can move between sections without confusion.

#### Acceptance Criteria

1. THE Application SHALL render a Sidebar on every page containing links to: Dashboard, Members, Contributions, Payments, Reports, Profile, and Settings.
2. WHILE the viewport width is 1024px or wider, THE Application SHALL display the full Sidebar alongside the page content.
3. WHILE the viewport width is below 768px, THE Application SHALL hide the Sidebar and display a Hamburger_Menu icon.
4. WHEN the user taps the Hamburger_Menu icon, THE Application SHALL toggle the Sidebar open or closed.
5. THE Application SHALL highlight the active navigation link corresponding to the currently open page.

---

### Requirement 3: Responsive Layout Breakpoints

**User Story:** As a user on any device, I want the interface to adapt to my screen size, so that the application is usable on desktop, laptop, tablet, and mobile.

#### Acceptance Criteria

1. WHILE the viewport width is 1440px or wider, THE Application SHALL display four Stat_Cards per row and the full Sidebar.
2. WHILE the viewport width is between 1024px and 1439px, THE Application SHALL display a narrower Sidebar and maintain four Stat_Cards per row.
3. WHILE the viewport width is between 768px and 1023px, THE Application SHALL collapse the Sidebar and display two Stat_Cards per row.
4. WHILE the viewport width is below 480px, THE Application SHALL display a single-column layout with a Hamburger_Menu.

---

### Requirement 4: API Layer

**User Story:** As a developer, I want all HTTP communication centralised in a single module, so that every page uses consistent data-fetching patterns and no page calls `fetch()` directly.

#### Acceptance Criteria

1. THE API_Layer SHALL expose the following functions: `getMembers`, `addMember`, `updateMember`, `deleteMember`, `getContributions`, `addContribution`, `updateContribution`, `deleteContribution`, `getPayments`, `addPayment`, `updatePayment`, `deletePayment`.
2. THE API_Layer SHALL target the JSON_Server base URL `http://localhost:3000` for all requests.
3. WHEN a network request fails, THE API_Layer SHALL throw an error containing a descriptive message.
4. IF a server response has an HTTP status code outside the 200–299 range, THEN THE API_Layer SHALL throw an error containing the status code and response body.
5. THE Application SHALL never call `fetch()` directly from any page script; all HTTP calls SHALL be made through the API_Layer.

---

### Requirement 5: JSON Server Data Store

**User Story:** As a developer, I want a mock REST API, so that the application can perform CRUD operations without a real backend.

#### Acceptance Criteria

1. THE JSON_Server SHALL expose the following resource collections at port 3000: `members`, `contributions`, `payments`, and `users`.
2. THE JSON_Server SHALL persist all data to `db.json` in the project root.
3. THE Application SHALL start the JSON_Server using the command `json-server --watch db.json --port 3000`.

---

### Requirement 6: Dashboard Statistics

**User Story:** As a group administrator, I want to see aggregated savings metrics at a glance, so that I can quickly understand the group's financial health.

#### Acceptance Criteria

1. THE Dashboard SHALL display four Stat_Cards showing: Total Savings (sum of all Payments), Total Contributions (sum of all Contribution amounts), Total Payments (sum of all Payment amounts), and Member count.
2. WHEN the Dashboard page loads, THE Dashboard SHALL fetch current data from the API_Layer and compute all Stat_Card values dynamically.
3. THE Dashboard SHALL format all monetary values using the Naira symbol (₦) with comma-separated thousands.

---

### Requirement 7: Dashboard Chart

**User Story:** As a group administrator, I want to see a savings progress chart, so that I can visualise contribution and payment trends over time.

#### Acceptance Criteria

1. THE Dashboard SHALL render a Chart.js line chart labelled "Savings Progress" showing two data series: monthly Contribution totals and monthly Payment totals.
2. WHEN the Dashboard page loads, THE Dashboard SHALL aggregate Contribution and Payment records by calendar month and supply the resulting data to the Chart.
3. THE Chart SHALL display month labels on the horizontal axis and monetary amounts on the vertical axis.

---

### Requirement 8: Dashboard Recent Activity

**User Story:** As a group administrator, I want to see recent contributions and activity, so that I can monitor day-to-day group activity from the Dashboard.

#### Acceptance Criteria

1. THE Dashboard SHALL display a "Recent Contributions" panel listing the five most recently recorded Contributions, showing Member name, amount, and date.
2. THE Dashboard SHALL display a "Latest Activities" feed listing the five most recent create, update, and delete operations across Members, Contributions, and Payments.

---

### Requirement 9: Members Management

**User Story:** As a group administrator, I want to add, view, edit, and delete members, so that the member list accurately reflects the current group composition.

#### Acceptance Criteria

1. THE Application SHALL display all Members in a Table with columns: Name, Phone, Contribution amount, and Status Badge.
2. WHEN the user submits the Add Member form, THE Application SHALL send a `POST` request via the API_Layer with the fields: Name, Phone, Email, Status, and Date Joined, and SHALL display a "Member Added" Toast on success.
3. WHEN the user submits the Edit Member form, THE Application SHALL send a `PUT` request via the API_Layer with the updated fields, and SHALL display a confirmation Toast on success.
4. WHEN the user confirms deletion of a Member, THE Application SHALL send a `DELETE` request via the API_Layer and SHALL remove the Member row from the Table.
5. THE Application SHALL display an "Active" Badge in green for Members whose Status is "Active".

---

### Requirement 10: Member Search and Pagination

**User Story:** As a group administrator, I want to search and paginate the member list, so that I can quickly locate specific members even as the list grows.

#### Acceptance Criteria

1. WHEN the user types in the Members search field, THE Application SHALL filter the displayed Table rows to only those whose Name or Phone contains the search string, updating results with each keystroke.
2. THE Application SHALL display Members in pages of four rows and SHALL render pagination controls showing the current range (e.g. "1–4 of 8").
3. WHEN the user clicks a pagination control, THE Application SHALL display the corresponding page of Member rows.

---

### Requirement 11: Contributions Management

**User Story:** As a group administrator, I want to record, view, edit, and delete contributions, so that every member's payment history is accurately tracked.

#### Acceptance Criteria

1. THE Application SHALL provide a "Record Contribution" form with fields: Member (dropdown populated from the API_Layer), Amount (₦), and Date.
2. WHEN the user submits the Record Contribution form, THE Application SHALL send a `POST` request via the API_Layer and SHALL display a "Contribution Recorded" Toast on success.
3. THE Application SHALL display all Contributions in a searchable, filterable Table with columns: Member name, Amount, and Date.
4. WHEN the user submits the Edit Contribution form, THE Application SHALL send a `PUT` request via the API_Layer with the updated fields and SHALL display a confirmation Toast on success.
5. WHEN the user confirms deletion of a Contribution, THE Application SHALL send a `DELETE` request via the API_Layer and SHALL remove the row from the Table.

---

### Requirement 12: Contributions Search and Filtering

**User Story:** As a group administrator, I want to search and sort contributions, so that I can locate specific records quickly.

#### Acceptance Criteria

1. WHEN the user types in the Contributions search field, THE Application SHALL filter Table rows to only those whose Member name, amount, or date contains the search string.
2. WHEN the user selects a sort option, THE Application SHALL reorder the Contributions Table accordingly. Supported sort options SHALL be: Newest, Oldest, Highest Amount, Lowest Amount, Name A–Z, Name Z–A.

---

### Requirement 13: Payments Management

**User Story:** As a group administrator, I want to record, update, and delete payments, so that disbursements to members are accurately tracked.

#### Acceptance Criteria

1. THE Application SHALL display all Payments in a Table with columns: Member name, Amount, Date, and Status Badge.
2. THE Application SHALL render a "Paid" Badge in green for Payments whose Status is "Paid" and a "Pending" Badge in orange for Payments whose Status is "Pending".
3. WHEN the user submits the Add Payment form, THE Application SHALL send a `POST` request via the API_Layer and SHALL display a confirmation Toast on success.
4. WHEN the user submits the Update Payment form, THE Application SHALL send a `PUT` request via the API_Layer with the updated fields and SHALL display a confirmation Toast on success.
5. WHEN the user confirms deletion of a Payment, THE Application SHALL send a `DELETE` request via the API_Layer and SHALL remove the Payment row from the Table.

---

### Requirement 14: Reports Page

**User Story:** As a group administrator, I want to view auto-calculated financial reports, so that I can assess the group's overall savings performance without manual calculations.

#### Acceptance Criteria

1. THE Application SHALL display the Reports page with four tabs: Summary, Contributions, Payments, and Members.
2. THE Application SHALL display the following metrics on the Summary tab, each computed dynamically from API_Layer data: Total Savings, Total Contributions, Total Payments, Outstanding balance (Total Contributions minus Total Payments), Active Members count, and Top Contributor (Member with the highest total Contribution amount).
3. THE Application SHALL NOT allow manual input of any value on the Reports page; all displayed values SHALL be derived from stored records.
4. WHEN the user clicks a tab, THE Application SHALL display the corresponding report content without a full page reload.

---

### Requirement 15: Profile Page

**User Story:** As a user, I want to view and edit my profile, so that my personal information in the application stays up to date.

#### Acceptance Criteria

1. THE Application SHALL display the Profile page with: Avatar image, Name, Phone, Group name, and Member Since date.
2. WHEN the user submits the Edit Profile form, THE Application SHALL update the user record via the API_Layer with the fields: Photo, Name, Phone, Email, and Password, and SHALL display a confirmation Toast on success.
3. IF the user submits the Edit Profile form with an empty Name or Email field, THEN THE Application SHALL display an inline validation error and SHALL NOT submit the request.

---

### Requirement 16: Settings Page

**User Story:** As a user, I want to manage application settings, so that I can configure the group, control notifications, and maintain account security.

#### Acceptance Criteria

1. THE Application SHALL display the Settings page with the following sections: Group Information, Notifications, Change Password, Backup Data, and Logout.
2. WHEN the user clicks Logout, THE Application SHALL clear any stored session data and SHALL navigate to `index.html`.
3. WHEN the user clicks Backup Data, THE Application SHALL export the current `db.json` content as a downloadable JSON file.

---

### Requirement 17: Form Validation

**User Story:** As a user, I want to see clear validation messages when I make input errors, so that I can correct my submissions without confusion.

#### Acceptance Criteria

1. IF the user submits any form with a required field left empty, THEN THE Application SHALL display an inline error message adjacent to that field and SHALL NOT submit the request.
2. IF the user submits a Member form with a Phone number that is not between 10 and 15 digits, THEN THE Application SHALL display an inline error message and SHALL NOT submit the request.
3. IF the user submits a Contribution or Payment form with an Amount of 0 or less, THEN THE Application SHALL display an inline error message and SHALL NOT submit the request.
4. IF the user submits an Add Member form where the Name and Phone combination already exists in the API_Layer, THEN THE Application SHALL display an inline duplicate-detection error and SHALL NOT submit the request.

---

### Requirement 18: Loading States

**User Story:** As a user, I want to see loading indicators while data is being fetched, so that I know the application is working and have not misclicked.

#### Acceptance Criteria

1. WHILE a fetch operation is in progress, THE Application SHALL display a Spinner or "Loading…" text in place of the data region.
2. WHILE a form submission is in progress, THE Application SHALL disable the submit button to prevent duplicate requests.
3. WHEN a fetch operation completes, THE Application SHALL remove the Spinner and render the fetched data.

---

### Requirement 19: Toast Notifications

**User Story:** As a user, I want to see brief success and error notifications after performing actions, so that I receive immediate feedback on every operation.

#### Acceptance Criteria

1. WHEN a Member is successfully added, THE Application SHALL display a Toast with the message "✓ Member Added".
2. WHEN a Contribution is successfully recorded, THE Application SHALL display a Toast with the message "✓ Contribution Recorded".
3. WHEN a Payment is successfully updated, THE Application SHALL display a Toast with the message "✓ Payment Updated".
4. WHEN any record is successfully deleted, THE Application SHALL display a Toast with the message "✓ Deleted Successfully".
5. THE Application SHALL automatically dismiss every Toast after 3 seconds without requiring user interaction.
6. IF an API_Layer call returns an error, THEN THE Application SHALL display an error Toast describing the failure.

---

### Requirement 20: Search and Sort for All Tables

**User Story:** As a group administrator, I want every data table to support searching and sorting, so that I can analyse data from any angle.

#### Acceptance Criteria

1. WHEN the user types in any table's search field, THE Application SHALL filter visible rows to those matching the search string across Name, Amount, and Date columns.
2. WHEN the user selects a sort option from any table's sort control, THE Application SHALL reorder the visible rows. Supported sort options SHALL be: Newest, Oldest, Highest Amount, Lowest Amount, Name A–Z, Name Z–A.

---

### Requirement 21: Visual Polish and Animations

**User Story:** As a user, I want smooth animations and consistent styling, so that the application feels professional and responsive to my interactions.

#### Acceptance Criteria

1. THE Application SHALL apply hover effects to all Table rows, raising them visually on cursor entry.
2. THE Application SHALL apply hover and focus transitions to all buttons and interactive controls, completing each transition within 200ms.
3. THE Application SHALL apply entry animations to Stat_Cards when the Dashboard page loads.
4. THE Application SHALL use Font Awesome icons in navigation links, Stat_Cards, and action buttons.
5. THE Application SHALL maintain consistent spacing using CSS custom properties throughout all pages.

---

### Requirement 22: Reusable UI Components

**User Story:** As a developer, I want shared, reusable UI components, so that visual consistency is maintained across all pages with minimal duplicated code.

#### Acceptance Criteria

1. THE Application SHALL define a single `.btn-primary`, `.btn-danger`, and `.btn-success` CSS class used consistently on all applicable buttons across all pages.
2. THE Application SHALL define a single `.table` CSS class applied to all data tables across all pages.
3. THE Application SHALL define a single Stat_Card HTML/CSS pattern used on the Dashboard and Reports pages.
4. THE Application SHALL define a single form CSS pattern used across the Add Member, Record Contribution, Add Payment, and Edit Profile forms.
5. THE Application SHALL render Toast notifications and Spinners from a single shared implementation in `utils.js` invoked by all page scripts.
