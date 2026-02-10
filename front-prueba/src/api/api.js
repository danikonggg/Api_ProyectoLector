const BASE_URL_KEY = 'api_lector_base_url';
const TOKEN_KEY = 'api_lector_token';
const USER_KEY = 'api_lector_user';

export function getBaseUrl() {
  const stored = localStorage.getItem(BASE_URL_KEY);
  if (stored) return stored.replace(/\/$/, '');
  // En dev con Vite (puerto 5173), usar proxy para evitar CORS
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export function setBaseUrl(val) {
  localStorage.setItem(BASE_URL_KEY, (val || '').replace(/\/$/, ''));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t || '');
}

export function getUser() {
  try {
    const s = localStorage.getItem(USER_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function setUser(u) {
  localStorage.setItem(USER_KEY, u ? JSON.stringify(u) : '');
}

export async function api(method, path, body, options = {}) {
  const url = `${getBaseUrl()}${path}`;
  const headers = getToken() ? { Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) } : { ...(options.headers || {}) };
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    ...options,
  });
  const contentType = res.headers.get('Content-Type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || JSON.stringify(data));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Subir archivo con FormData (multipart/form-data).
 * No usa Content-Type para que el navegador añada el boundary.
 */
export async function apiUpload(path, formData) {
  const url = `${getBaseUrl()}${path}`;
  const headers = {};
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  const contentType = res.headers.get('Content-Type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || String(data));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
