const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

// CSRF token management with ready signal
let csrfToken = null;
let csrfResolve = null;
let csrfReady = new Promise(resolve => { csrfResolve = resolve; });

export function setCsrfToken(token) {
  csrfToken = token;
  if (token && csrfResolve) {
    csrfResolve();
    csrfResolve = null;
  }
}

function getCsrfHeaders(method) {
  const headers = { 'Content-Type': 'application/json' };
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method?.toUpperCase())) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  // Wait for CSRF token before sending mutations (max 5s)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && !csrfToken) {
    await Promise.race([csrfReady, new Promise(r => setTimeout(r, 5000))]);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: { ...getCsrfHeaders(method), ...options.headers },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || `Request failed: ${res.status}`);
      err.status = res.status;
      err.details = body.details;
      throw err;
    }

    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  }
}

async function uploadFiles(path, files, category) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  if (category) formData.append('category', category);

  const headers = {};
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  // Wait for CSRF token before upload
  if (!csrfToken) {
    await Promise.race([csrfReady, new Promise(r => setTimeout(r, 5000))]);
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || `Upload failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }

    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Upload timed out. The file may be too large or your connection is slow.');
    }
    throw err;
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  upload: uploadFiles,
};
