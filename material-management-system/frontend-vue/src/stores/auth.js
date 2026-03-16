import { defineStore } from 'pinia'
import { authAPI } from '@/api/index.js'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isVip: (s) => s.user?.vip_level >= 1,
    isAdmin: (s) => s.user?.roles?.includes('admin'),
    vipLevel: (s) => s.user?.vip_level || 0,
  },
  actions: {
    async login(username, password) {
      const res = await authAPI.login({ username, password })
      if (res.token) {
        this.token = res.token
        this.user = res.user
        localStorage.setItem('token', res.token)
        localStorage.setItem('user', JSON.stringify(res.user))
        if (res.refreshToken) localStorage.setItem('refreshToken', res.refreshToken)
        return { ok: true }
      }
      return { ok: false, message: res.message }
    },
    async register(data) {
      const res = await authAPI.register(data)
      return res
    },
    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('refreshToken')
    },
    updateUser(updates) {
      this.user = { ...this.user, ...updates }
      localStorage.setItem('user', JSON.stringify(this.user))
    }
  }
})
