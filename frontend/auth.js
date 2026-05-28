/* ============================================================
   VerifyIt — Authentication Module
   Handles user authentication, tokens, and session management
   ============================================================ */

const API_BASE_URL = "https://verifyit-3.onrender.com"
// (window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'http://127.0.0.1:8000';
const TOKEN_KEY = 'verifyit-token';
const USER_KEY = 'verifyit-user';

// --- Token Management ---
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// --- User Management ---
function getCurrentUser() {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

function setCurrentUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function removeCurrentUser() {
  localStorage.removeItem(USER_KEY);
}

// --- Authentication Status ---
function isAuthenticated() {
  return !!getToken();
}

function requireAuth() {
  if (!isAuthenticated()) {
    localStorage.setItem('redirect_after_login', window.location.href);
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// --- Auth Headers ---
function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// --- Logout ---
async function logout() {
  try {
    const token = getToken();
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    removeToken();
    removeCurrentUser();
    window.location.href = 'login.html';
  }
}

// --- Verify Token ---
async function verifyToken() {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (response.ok) {
      const user = await response.json();
      setCurrentUser(user);
      return true;
    } else if (response.status === 401) {
      removeToken();
      removeCurrentUser();
      return false;
    }
  } catch (error) {
    console.error('Token verification error:', error);
  }
  
  return false;
}

// --- API Fetch with Auth ---
async function apiCall(endpoint, options = {}) {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    removeToken();
    removeCurrentUser();
    window.location.href = 'login.html';
    throw new Error('Session expired. Please login again.');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'API error');
  }

  return data;
}

// --- Initialize Auth ---
async function initAuth() {
  // Check if token is valid
  if (isAuthenticated()) {
    const isValid = await verifyToken();
    if (!isValid && !window.location.href.includes('login.html') && !window.location.href.includes('register.html')) {
      // Token invalid, redirect to login
      requireAuth();
    }
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
