<template>
  <div class="auth-page">
    <div style="width:100%; max-width:420px;">
      <div class="auth-logo">📦 诸城叙梦</div>
      <div class="form-container">
        <div class="form-title">创建账户</div>
        <div class="form-subtitle">加入诸城叙梦素材平台</div>

        <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
        <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

        <form @submit.prevent="handleRegister" v-if="!successMsg">
          <div class="form-group">
            <label class="form-label">用户名 <span class="text-muted text-xs">（3-20 位字母/数字/下划线）</span></label>
            <input
              v-model="form.username"
              type="text"
              class="form-input"
              :class="{ error: errors.username }"
              placeholder="请输入用户名"
              autocomplete="username"
              minlength="3"
              maxlength="20"
            />
            <div class="form-error" v-if="errors.username">{{ errors.username }}</div>
          </div>
          <div class="form-group">
            <label class="form-label">密码 <span class="text-muted text-xs">（至少 6 位）</span></label>
            <input
              v-model="form.password"
              type="password"
              class="form-input"
              :class="{ error: errors.password }"
              placeholder="请输入密码"
              autocomplete="new-password"
              minlength="6"
            />
            <div class="form-error" v-if="errors.password">{{ errors.password }}</div>
          </div>
          <div class="form-group">
            <label class="form-label">邮箱 <span class="text-muted text-xs">（可选，用于找回密码）</span></label>
            <input
              v-model="form.email"
              type="email"
              class="form-input"
              :class="{ error: errors.email }"
              placeholder="请输入邮箱（可选）"
              autocomplete="email"
            />
            <div class="form-error" v-if="errors.email">{{ errors.email }}</div>
          </div>
          <button type="submit" class="form-submit" :disabled="loading">
            {{ loading ? '注册中...' : '注册' }}
          </button>
        </form>

        <div class="form-link">
          已有账户？<RouterLink to="/login">立即登录</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { authAPI } from '@/api/index.js'

const router = useRouter()

const form = reactive({ username: '', password: '', email: '' })
const errors = reactive({ username: '', password: '', email: '' })
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

function validate() {
  errors.username = ''
  errors.password = ''
  errors.email = ''
  let valid = true
  if (form.username.length < 3) {
    errors.username = '用户名至少 3 位'
    valid = false
  }
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(form.username)) {
    errors.username = '用户名只能包含字母、数字、下划线或中文'
    valid = false
  }
  if (form.password.length < 6) {
    errors.password = '密码至少 6 位'
    valid = false
  }
  if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
    errors.email = '邮箱格式不正确'
    valid = false
  }
  return valid
}

async function handleRegister() {
  errorMsg.value = ''
  if (!validate()) return
  loading.value = true
  try {
    const data = { username: form.username, password: form.password }
    if (form.email) data.email = form.email
    const res = await authAPI.register(data)
    if (res.message && !res.error) {
      if (res.emailSent) {
        successMsg.value = '注册成功！验证码已发送至邮箱，请登录后在「帮助中心 → 账户设置」完成验证。3 秒后跳转...'
      } else {
        successMsg.value = '注册成功！3 秒后跳转到登录页...'
      }
      setTimeout(() => router.push('/login'), 3000)
    } else {
      errorMsg.value = res.message || res.error || '注册失败，请稍后重试'
    }
  } catch (e) {
    errorMsg.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>
