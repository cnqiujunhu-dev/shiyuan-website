<template>
  <div class="auth-page">
    <div style="width:100%; max-width:420px;">
      <div class="auth-logo">📦 诸城叙梦</div>
      <div class="form-container">
        <div class="form-title">找回密码</div>
        <div class="form-subtitle">{{ step === 1 ? '输入注册邮箱获取验证码' : '输入验证码和新密码' }}</div>

        <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
        <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

        <!-- Step 1: Send reset code -->
        <form v-if="step === 1 && !successMsg" @submit.prevent="handleSendCode">
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input
              v-model="email"
              type="email"
              class="form-input"
              placeholder="请输入注册时使用的邮箱"
              required
            />
          </div>
          <button type="submit" class="form-submit" :disabled="loading">
            {{ loading ? '发送中...' : '发送验证码' }}
          </button>
        </form>

        <!-- Step 2: Reset password -->
        <form v-if="step === 2 && !successMsg" @submit.prevent="handleReset">
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input v-model="email" type="email" class="form-input" disabled />
          </div>
          <div class="form-group">
            <label class="form-label">验证码</label>
            <input
              v-model="code"
              type="text"
              class="form-input"
              placeholder="请输入邮件中的验证码"
              required
            />
          </div>
          <div class="form-group">
            <label class="form-label">新密码</label>
            <input
              v-model="newPassword"
              type="password"
              class="form-input"
              placeholder="请输入新密码（至少 6 位）"
              minlength="6"
              required
            />
          </div>
          <button type="submit" class="form-submit" :disabled="loading">
            {{ loading ? '重置中...' : '重置密码' }}
          </button>
          <button type="button" class="btn btn-ghost" style="width:100%;margin-top:8px;" @click="step = 1">
            重新发送
          </button>
        </form>

        <div class="form-link">
          <RouterLink to="/login">返回登录</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authAPI } from '@/api/index.js'

const router = useRouter()

const step = ref(1)
const email = ref('')
const code = ref('')
const newPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

async function handleSendCode() {
  errorMsg.value = ''
  loading.value = true
  try {
    const res = await authAPI.forgotPassword(email.value)
    if (res.message && !res.error) {
      step.value = 2
    } else {
      errorMsg.value = res.message || res.error || '发送失败，请检查邮箱是否正确'
    }
  } catch (e) {
    errorMsg.value = e?.message || '发送失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function handleReset() {
  errorMsg.value = ''
  if (newPassword.value.length < 6) {
    errorMsg.value = '新密码至少 6 位'
    return
  }
  loading.value = true
  try {
    const res = await authAPI.resetPassword({
      email: email.value,
      code: code.value,
      new_password: newPassword.value
    })
    if (res.message && !res.error) {
      successMsg.value = '密码重置成功！3 秒后跳转到登录页...'
      setTimeout(() => router.push('/login'), 3000)
    } else {
      errorMsg.value = res.message || res.error || '重置失败，请检查验证码是否正确'
    }
  } catch (e) {
    errorMsg.value = e?.message || '重置失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>
