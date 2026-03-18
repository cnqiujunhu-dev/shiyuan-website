const BASE = '/api'

function getHeaders(isJson = true) {
  const h = {}
  const token = localStorage.getItem('token')
  if (token) h['Authorization'] = `Bearer ${token}`
  if (isJson) h['Content-Type'] = 'application/json'
  return h
}

async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    ...options,
    headers: { ...getHeaders(!(options.body instanceof FormData)), ...options.headers }
  })
  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    return {}
  }
  return res.json()
}

// Auth
export const authAPI = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  sendVerifyEmail: (email) => request('/auth/email/send-verify', { method: 'POST', body: JSON.stringify(email ? { email } : {}) }),
  verifyEmail: (code) => request('/auth/email/verify', { method: 'POST', body: JSON.stringify({ code }) }),
  forgotPassword: (email) => request('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (data) => request('/auth/password/reset', { method: 'POST', body: JSON.stringify(data) }),
  changePassword: (data) => request('/auth/password/change', { method: 'POST', body: JSON.stringify(data) }),
}

// Me
export const meAPI = {
  getSummary: () => request('/me/summary'),
  getActivities: (params = {}) => request('/me/activities?' + new URLSearchParams(params)),
}

// My Assets
export const assetsAPI = {
  getMyAssets: (params = {}) => request('/assets?' + new URLSearchParams(params)),
  transfer: (data) => request('/assets/transfer', { method: 'POST', body: JSON.stringify(data) }),
  sponsor: (data) => request('/assets/sponsor', { method: 'POST', body: JSON.stringify(data) }),
  registerSponsor: (data) => request('/assets/register-sponsor', { method: 'POST', body: JSON.stringify(data) }),
}

// Applications
export const applicationsAPI = {
  buyback: (data) => request('/applications/buyback', { method: 'POST', body: JSON.stringify(data) }),
  getMyApplications: (params = {}) => request('/applications?' + new URLSearchParams(params)),
}

// Shop
export const shopAPI = {
  getItems: (params = {}) => request('/shop/items?' + new URLSearchParams(params)),
  buyItem: (id) => request(`/shop/items/${id}/buy`, { method: 'POST' }),
  skipQueueBuy: (id) => request(`/shop/items/${id}/skip-queue`, { method: 'POST' }),
}
