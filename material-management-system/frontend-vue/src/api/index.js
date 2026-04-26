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

  let data = {}
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error(data.message || '登录已过期，请重新登录')
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || `请求失败（${res.status}）`)
  }

  return data
}

// Auth
export const authAPI = {
  sendRegisterCode: (data) => request('/auth/register/send-code', { method: 'POST', body: JSON.stringify(data) }),
  verifyRegisterCode: (data) => request('/auth/register/verify-code', { method: 'POST', body: JSON.stringify(data) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  sendLoginCode: (data) => request('/auth/login/send-code', { method: 'POST', body: JSON.stringify(data) }),
  loginWithCode: (data) => request('/auth/login/code', { method: 'POST', body: JSON.stringify(data) }),
  sendVerifyEmail: (email) => request('/auth/email/send-verify', { method: 'POST', body: JSON.stringify(email ? { email } : {}) }),
  verifyEmail: (code) => request('/auth/email/verify', { method: 'POST', body: JSON.stringify({ code }) }),
  forgotPassword: (email) => request('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (data) => request('/auth/password/reset', { method: 'POST', body: JSON.stringify(data) }),
  changePassword: (data) => request('/auth/password/change', { method: 'POST', body: JSON.stringify(data) }),
}

// Me
export const meAPI = {
  getSummary: () => request('/me/summary'),
  addIdentity: (data) => request('/me/identities', { method: 'POST', body: JSON.stringify(data) }),
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
  getVipLevels: () => request('/shop/vip-levels'),
  buyItem: (id) => request(`/shop/items/${id}/buy`, { method: 'POST' }),
  skipQueueBuy: (id) => request(`/shop/items/${id}/skip-queue`, { method: 'POST' }),
}
