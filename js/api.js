/**
 * api.js — API Layer
 *
 * Centralises all HTTP communication with the JSON Server mock REST API.
 * No page script should ever call fetch() directly; use the exported
 * functions below instead.
 *
 * Base URL: http://localhost:3000
 */

const BASE_URL = 'http://localhost:3000';

/**
 * Base fetch wrapper used by all exported functions.
 *
 * @param {string} method  - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} path    - Resource path, e.g. '/members' or '/members/1'
 * @param {object} [body]  - Optional request body (will be JSON-serialised)
 * @returns {Promise<any>} Parsed JSON response body
 * @throws {Error} On network failure or non-2xx HTTP status
 */
async function apiCall(method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new Error(
      `Network error while calling ${method} ${path}: ${networkError.message}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  // DELETE responses from JSON Server often return an empty body (200/204)
  const contentType = res.headers.get('Content-Type') || '';
  if (res.status === 204 || !contentType.includes('application/json')) {
    return null;
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Members — /members
// ---------------------------------------------------------------------------

/** Fetch all members. */
export const getMembers = () => apiCall('GET', '/members');

/** Create a new member. @param {object} data Member fields */
export const addMember = (data) => apiCall('POST', '/members', data);

/** Replace a member record. @param {string|number} id @param {object} data */
export const updateMember = (id, data) => apiCall('PUT', `/members/${id}`, data);

/** Delete a member by id. @param {string|number} id */
export const deleteMember = (id) => apiCall('DELETE', `/members/${id}`);

// ---------------------------------------------------------------------------
// Contributions — /contributions
// ---------------------------------------------------------------------------

/** Fetch all contributions. */
export const getContributions = () => apiCall('GET', '/contributions');

/** Create a new contribution. @param {object} data Contribution fields */
export const addContribution = (data) => apiCall('POST', '/contributions', data);

/** Replace a contribution record. @param {string|number} id @param {object} data */
export const updateContribution = (id, data) =>
  apiCall('PUT', `/contributions/${id}`, data);

/** Delete a contribution by id. @param {string|number} id */
export const deleteContribution = (id) => apiCall('DELETE', `/contributions/${id}`);

// ---------------------------------------------------------------------------
// Payments — /payments
// ---------------------------------------------------------------------------

/** Fetch all payments. */
export const getPayments = () => apiCall('GET', '/payments');

/** Create a new payment. @param {object} data Payment fields */
export const addPayment = (data) => apiCall('POST', '/payments', data);

/** Replace a payment record. @param {string|number} id @param {object} data */
export const updatePayment = (id, data) => apiCall('PUT', `/payments/${id}`, data);

/** Delete a payment by id. @param {string|number} id */
export const deletePayment = (id) => apiCall('DELETE', `/payments/${id}`);

// ---------------------------------------------------------------------------
// Activities — /activities
// ---------------------------------------------------------------------------

/** Fetch all activities. */
export const getActivities = () => apiCall('GET', '/activities');

/** Create a new activity entry. @param {object} data */
export const addActivity = (data) => apiCall('POST', '/activities', data);

// ---------------------------------------------------------------------------
// Payment Requests — /payment_requests
// ---------------------------------------------------------------------------

/** Fetch all payment requests. */
export const getPaymentRequests = () => apiCall('GET', '/payment_requests');

/** Create a new payment request. @param {object} data */
export const addPaymentRequest = (data) => apiCall('POST', '/payment_requests', data);

/** Update a payment request (approve/reject). @param {string|number} id @param {object} data */
export const updatePaymentRequest = (id, data) => apiCall('PUT', `/payment_requests/${id}`, data);

/** Delete a payment request. @param {string|number} id */
export const deletePaymentRequest = (id) => apiCall('DELETE', `/payment_requests/${id}`);

// ---------------------------------------------------------------------------
// Users — /users  (used by profile.html)
// ---------------------------------------------------------------------------

/** Fetch a single user by id. @param {string|number} id */
export const getUser = (id) => apiCall('GET', `/users/${id}`);

/** Replace a user record. @param {string|number} id @param {object} data */
export const updateUser = (id, data) => apiCall('PUT', `/users/${id}`, data);
