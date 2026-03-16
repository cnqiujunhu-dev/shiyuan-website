<template>
  <div class="auth-page">
    <div style="width:100%; max-width:420px;">
      <div class="auth-logo">📦 诸城叙梦</div>
      <div class="form-container">
        <div class="form-title">欢迎回来</div>
        <div class="form-subtitle">登录您的账户</div>

        <div v-if="error" class="alert alert-error">{{ error }}</div>

        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input
              v-model="form.username"
              type="text"
              class="form-input"
              placeholder="请输入用户名"
              autocomplete="username"
              required
            />
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input
              v-model="form.password"
              type="password"
              class="form-input"
              placeholder="请输入密码"
              autocomplete="current-password"
              required
            />
          </div>
          <button type="submit" class="form-submit" :disabled="loading">
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>

        <div class="form-link">
          还没有账户？<RouterLink to="/register">立即注册</RouterLink>
        </div>
        <div class="form-link">
          <RouterLink to="/forgot-password">忘记密码？</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'

const router = useRouter()
const auth = useAuthStore()

const form = ref({ username: '', password: '' })
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const result = await auth.login(form.value.username, form.value.password)
    if (result.ok) {
      router.push('/my-assets')
    } else {
      error.value = result.message || '登录失败，请检查用户名和密码'
    }
  } catch (e) {
    error.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>
