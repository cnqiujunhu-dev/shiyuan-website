const API_BASE = '/api';

function getHeaders(isJson = true) {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (isJson) headers['Content-Type'] = 'application/json';
  return headers;
}

async function handleResponse(res) {
  // Auto-redirect on token expiry
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return {};
  }
  return res.json();
}

export async function register(data) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(res);
}

export async function login(data) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(res);
}

export async function fetchAssets(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/assets?${query}`, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function uploadAsset(formData) {
  const res = await fetch(`${API_BASE}/assets/upload`, {
    method: 'POST',
    headers: getHeaders(false),
    body: formData
  });
  return handleResponse(res);
}

export async function deleteAsset(id) {
  const res = await fetch(`${API_BASE}/assets/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function downloadAsset(id, filename) {
  const res = await fetch(`${API_BASE}/assets/download/${id}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('下载失败');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
