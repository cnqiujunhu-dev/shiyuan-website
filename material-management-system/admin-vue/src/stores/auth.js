import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authAPI } from '../api/index.js'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('adminToken') || null)
  const user = ref(null)

  // Try to parse stored user info
  try {
    const storedUser = localStorage.getItem('adminUser')
    if (storedUser) {
      user.value = JSON.parse(storedUser)
    }
  } catch (e) {
    // ignore
  }

  const isLoggedIn = computed(() => !!token.value)

  const isAdmin = computed(() => {
    if (!user.value) return false
    const roles = user.value.roles || []
    return roles.includes('admin')
  })

  async function login(credentials) {
    const res = await authAPI.login(credentials)

    if (res.error) {
      throw new Error(res.error)
    }

    if (!res.token) {
      throw new Error('登录失败，服务器未返回令牌')
    }

    // Check admin role
    const roles = res.user?.roles || []
    if (!roles.includes('admin')) {
      throw new Error('无管理员权限')
    }

    token.value = res.token
    user.value = res.user

    localStorage.setItem('adminToken', res.token)
    localStorage.setItem('adminUser', JSON.stringify(res.user))

    return res
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
  }

  return { token, user, isLoggedIn, isAdmin, login, logout }
})
