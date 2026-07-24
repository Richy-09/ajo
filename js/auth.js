/**
 * auth.js — Session management and route guards
 *
 * Session is saved to both localStorage and sessionStorage for
 * maximum compatibility across page navigations and browser modes.
 */

const KEY = 'ajo_user';

/** Save session to both storages. */
export function saveSession(user) {
  const json = JSON.stringify(user);
  try { localStorage.setItem(KEY, json); }   catch {}
  try { sessionStorage.setItem(KEY, json); } catch {}
}

/** Read session. Returns null if not found. */
export function getSession() {
  try {
    const raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** True if any valid session exists. */
export function isLoggedIn() {
  return getSession() !== null;
}

/** Clear session from all storages and redirect to login. */
export function logout() {
  try { localStorage.removeItem(KEY); }   catch {}
  try { sessionStorage.removeItem(KEY); } catch {}
  window.location.href = 'login.html';
}

/**
 * Guard — any logged-in user (admin or member).
 * Redirects to login if no session.
 */
export function requireAuth() {
  const user = getSession();
  if (!user) { window.location.href = 'login.html'; return null; }
  return user;
}

/**
 * Guard — admin only.
 * Redirects to login if no session or role is not 'admin'.
 */
export function requireAdmin() {
  const user = getSession();
  if (!user || user.role !== 'admin') {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

/**
 * Guard — member only.
 * Redirects to login if no session or role is not 'member'.
 */
export function requireMember() {
  const user = getSession();
  if (!user || user.role !== 'member') {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}
