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
    localStorage.removeItem('adminToken')
    window.location.href = '/login'
    throw new Error(data.message || '登录已过期，请重新登录')
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || `请求失败（${res.status}）`)
  }

  return data
}

async function download(url, filename) {
  const res = await fetch(BASE + url, { headers: getHeaders(false) })
  if (!res.ok) {
    let message = `下载失败（${res.status}）`
    try {
      const data = await res.json()
      message = data.message || data.error || message
    } catch {
      // Keep fallback message.
    }
    throw new Error(message)
  }
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

// Auth
export const authAPI = {
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
}

// Admin - Items
export const itemsAPI = {
  getAll: (params = {}) => request('/admin/items?' + new URLSearchParams(params)),
  create: (formData) => request('/admin/items', { method: 'POST', body: formData }),
  update: (id, data) => request(`/admin/items/${id}`, { method: 'PUT', body: data instanceof FormData ? data : JSON.stringify(data) }),
  getById: (id) => request(`/admin/items/${id}`),
  importBatch: (data) => request('/admin/items/import', { method: 'POST', body: JSON.stringify(data) }),
  getOwnerships: (id, params = {}) => request(`/admin/items/${id}/ownerships?` + new URLSearchParams(params)),
  updateOwnership: (id, ownershipId, data) => request(`/admin/items/${id}/ownerships/${ownershipId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  exportOwnerships: (id, filename = '授权名单.csv') => download(`/admin/items/${id}/ownerships/export`, filename),
}

// Admin - Transactions
export const transactionsAPI = {
  getAll: (params = {}) => request('/admin/transactions?' + new URLSearchParams(params)),
  importBatch: (data) => request('/admin/transactions/import', { method: 'POST', body: JSON.stringify(data) }),
  importAuthorizations: (data) => request('/admin/transactions/import-authorizations', { method: 'POST', body: JSON.stringify(data) }),
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
  getById: (id) => request(`/admin/users/${id}`),
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
