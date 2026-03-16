const BASE = '/api'

function getHeaders(isJson = true) {
  const h = {}
  const token = localStorage.getItem('adminToken')
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
    localStorage.removeItem('adminToken')
    window.location.href = '/login'
    return {}
  }
  return res.json()
}

// Auth
export const authAPI = {
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
}

// Admin - Items
export const itemsAPI = {
  getAll: (params = {}) => request('/admin/items?' + new URLSearchParams(params)),
  create: (formData) => request('/admin/items', { method: 'POST', body: formData }),
  update: (id, data) => request(`/admin/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getById: (id) => request(`/admin/items/${id}`),
  getOwnerships: (id, params = {}) => request(`/admin/items/${id}/ownerships?` + new URLSearchParams(params)),
}

// Admin - Transactions
export const transactionsAPI = {
  getAll: (params = {}) => request('/admin/transactions?' + new URLSearchParams(params)),
  importBatch: (data) => request('/admin/transactions/import', { method: 'POST', body: JSON.stringify(data) }),
}

// Admin - VIPs
export const vipsAPI = {
  getLevels: () => request('/admin/vips/levels'),
  createLevel: (data) => request('/admin/vips/levels', { method: 'POST', body: JSON.stringify(data) }),
  updateLevel: (id, data) => request(`/admin/vips/levels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  importVips: (data) => request('/admin/vips/import', { method: 'POST', body: JSON.stringify(data) }),
  getCustomers: (params = {}) => request('/admin/vips/customers?' + new URLSearchParams(params)),
  updateCustomer: (id, data) => request(`/admin/vips/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetCounters: (data = {}) => request('/admin/vips/reset-counters', { method: 'POST', body: JSON.stringify(data) }),
  resetAnnualSpend: () => request('/admin/vips/reset-annual-spend', { method: 'POST' }),
}

// Admin - Users
export const usersAPI = {
  getAll: (params = {}) => request('/admin/users?' + new URLSearchParams(params)),
  update: (id, data) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

// Admin - Applications
export const applicationsAPI = {
  getAll: (params = {}) => request('/admin/applications?' + new URLSearchParams(params)),
  decide: (id, data) => request(`/admin/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// Admin - Transfers
export const transfersAPI = {
  getAll: (params = {}) => request('/admin/transfers?' + new URLSearchParams(params)),
  rollback: (id) => request(`/admin/transfers/${id}/rollback`, { method: 'POST' }),
}

// Health
export const healthAPI = {
  check: () => request('/health'),
}
