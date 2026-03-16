// 封装统一的 API 调用函数
const API_BASE = '/api';

function getHeaders(isJson = true) {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export async function register(data) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function login(data) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function fetchAssets(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/assets?${query}`, {
    headers: getHeaders()
  });
  return res.json();
}

export async function uploadAsset(formData) {
  const res = await fetch(`${API_BASE}/assets/upload`, {
    method: 'POST',
    headers: getHeaders(false),
    body: formData
  });
  return res.json();
}

export async function deleteAsset(id) {
  const res = await fetch(`${API_BASE}/assets/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return res.json();
}