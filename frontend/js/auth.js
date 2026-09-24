// Base URL of the backend API. Change this if your backend runs elsewhere.
const API_BASE = 'http://localhost:5001/api';

const Auth = {
  getAccessToken() {
    return localStorage.getItem('accessToken');
  },
  setAccessToken(token) {
    localStorage.setItem('accessToken', token);
  },
  clearAccessToken() {
    localStorage.removeItem('accessToken');
  },

  // Wraps fetch to attach the access token and auto-retry once on 401 via refresh
  async request(path, options = {}) {
    const doFetch = (token) =>
      fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: 'include', // send the httpOnly refresh cookie
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

    let res = await doFetch(this.getAccessToken());

    if (res.status === 401) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        res = await doFetch(this.getAccessToken());
      }
    }

    return res;
  },

  async tryRefresh() {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    }
  },

  async signup({ name, email, password }) {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data);
    this.setAccessToken(data.accessToken);
    return data.user;
  },

  async login({ email, password }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data);
    this.setAccessToken(data.accessToken);
    return data.user;
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      this.clearAccessToken();
    }
  },

  async getProfile() {
    const res = await this.request('/auth/me');
    const data = await res.json();
    if (!res.ok) throw new ApiError(data);
    return data.user;
  },
};

class ApiError extends Error {
  constructor(data) {
    super(data.message || 'Request failed');
    this.errors = data.errors || [];
  }
}

// ---------- UI helpers shared by login/signup pages ----------

function showBanner(el, message, type = 'error') {
  el.textContent = message;
  el.className = `banner show ${type}`;
}

function hideBanner(el) {
  el.className = 'banner';
}

function setFieldError(fieldEl, message) {
  const errorEl = fieldEl.querySelector('.field-error');
  if (errorEl) errorEl.textContent = message || '';
}

function clearFieldErrors(formEl) {
  formEl.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
}

function applyServerValidationErrors(formEl, apiError) {
  clearFieldErrors(formEl);
  (apiError.errors || []).forEach((e) => {
    const field = formEl.querySelector(`[data-field="${e.path}"]`);
    if (field) setFieldError(field, e.msg);
  });
}
