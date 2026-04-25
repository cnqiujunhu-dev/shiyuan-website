<template>
  <div class="auth-page">
    <div style="width:100%; max-width:420px;">
      <div class="auth-logo">📦 诸城叙梦</div>
      <div class="form-container">
        <div class="form-title">创建账户</div>
        <div class="form-subtitle">QQ 邮箱验证后提交审核</div>

        <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
        <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

        <form @submit.prevent="handleRegister" v-if="!registrationComplete">
          <div class="form-group">
            <label class="form-label">自定义 ID <span class="text-muted text-xs">（2-30 位，可含中文或常用符号）</span></label>
            <input
              v-model="form.username"
              type="text"
              class="form-input"
              :class="{ error: errors.username }"
              placeholder="请输入自定义 ID"
              autocomplete="username"
              minlength="2"
              maxlength="30"
            />
            <div class="form-error" v-if="errors.username">{{ errors.username }}</div>
          </div>
          <div class="form-group">
            <label class="form-label">QQ 邮箱</label>
            <div style="display:flex;gap:8px;">
              <input
                v-model="form.email"
                type="email"
                class="form-input"
                :class="{ error: errors.email }"
                placeholder="请输入 QQ 邮箱"
                autocomplete="email"
                :disabled="codeSent"
              />
              <button
                v-if="codeSent"
                type="button"
                class="btn btn-secondary"
                style="white-space:nowrap;"
                @click="resetEmailStep"
              >
                修改
              </button>
            </div>
            <div class="form-error" v-if="errors.email">{{ errors.email }}</div>
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
            <label class="form-label">确认密码</label>
            <input
              v-model="form.confirmPassword"
              type="password"
              class="form-input"
              :class="{ error: errors.confirmPassword }"
              placeholder="请再次输入密码"
              autocomplete="new-password"
            />
            <div class="form-error" v-if="errors.confirmPassword">{{ errors.confirmPassword }}</div>
          </div>
          <div v-if="codeSent" class="form-group">
            <label class="form-label">邮箱验证码</label>
            <input
              v-model="form.code"
              type="text"
              inputmode="numeric"
              class="form-input"
              :class="{ error: errors.code }"
              placeholder="请输入 6 位验证码"
              maxlength="6"
              autocomplete="one-time-code"
            />
            <div class="form-error" v-if="errors.code">{{ errors.code }}</div>
            <button
              type="button"
              class="btn btn-secondary"
              style="margin-top:8px;width:100%;"
              :disabled="loading || resendSeconds > 0"
              @click="sendCode"
            >
              {{ resendSeconds > 0 ? `${resendSeconds} 秒后可重发` : '重新发送验证码' }}
            </button>
          </div>
          <button type="submit" class="form-submit" :disabled="loading">
            {{ loading ? (codeSent ? '提交中...' : '发送中...') : (codeSent ? '提交审核' : '发送邮箱验证码') }}
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
import { ref, reactive, onBeforeUnmount } from 'vue'
import { authAPI } from '@/api/index.js'

const form = reactive({ username: '', email: '', password: '', confirmPassword: '', code: '' })
const errors = reactive({ username: '', email: '', password: '', confirmPassword: '', code: '' })
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const registrationComplete = ref(false)
const codeSent = ref(false)
const resendSeconds = ref(0)
let resendTimer = null

function clearErrors() {
  errors.username = ''
  errors.email = ''
  errors.password = ''
  errors.confirmPassword = ''
  errors.code = ''
}

function validateAccount() {
  clearErrors()
  let valid = true
  const username = form.username.trim()
  if (username.length < 2 || username.length > 30) {
    errors.username = '自定义 ID 长度须为 2-30 位'
    valid = false
  }
  if (!/^[^\r\n\t<>]+$/.test(username)) {
    errors.username = '自定义 ID 不能包含换行或尖括号'
    valid = false
  }
  if (form.password.length < 6) {
    errors.password = '密码至少 6 位'
    valid = false
  }
  if (!form.email) {
    errors.email = '请输入邮箱'
    valid = false
  } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
    errors.email = '邮箱格式不正确'
    valid = false
  } else if (!isQQEmail(form.email)) {
    errors.email = '请使用 QQ 邮箱'
    valid = false
  }
  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = '两次输入的密码不一致'
    valid = false
  }
  return valid
}

function isQQEmail(email) {
  const domain = String(email || '').trim().toLowerCase().split('@')[1]
  return ['qq.com', 'vip.qq.com', 'foxmail.com'].includes(domain)
}

function validateCode() {
  if (!/^\d{6}$/.test(form.code.trim())) {
    errors.code = '请输入 6 位验证码'
    return false
  }
  errors.code = ''
  return true
}

function startResendCountdown(seconds = 60) {
  resendSeconds.value = seconds
  if (resendTimer) clearInterval(resendTimer)
  resendTimer = setInterval(() => {
    resendSeconds.value -= 1
    if (resendSeconds.value <= 0) {
      clearInterval(resendTimer)
      resendTimer = null
    }
  }, 1000)
}

function resetEmailStep() {
  codeSent.value = false
  form.code = ''
  successMsg.value = ''
  if (resendTimer) clearInterval(resendTimer)
  resendTimer = null
  resendSeconds.value = 0
}

async function sendCode() {
  errorMsg.value = ''
  successMsg.value = ''
  if (!validateAccount()) return
  loading.value = true
  try {
    await authAPI.sendRegisterCode({ username: form.username.trim(), email: form.email })
    codeSent.value = true
    successMsg.value = '验证码已发送，请在 10 分钟内提交审核。'
    startResendCountdown(60)
  } catch (e) {
    errorMsg.value = e?.message || '验证码发送失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  if (!codeSent.value) {
    await sendCode()
    return
  }
  errorMsg.value = ''
  if (!validateAccount() || !validateCode()) return
  loading.value = true
  try {
    const res = await authAPI.register({
      username: form.username.trim(),
      email: form.email,
      password: form.password,
      code: form.code.trim()
    })
    registrationComplete.value = true
    successMsg.value = res.message || '注册申请已提交，审核通过后会发送邮件通知您登录。'
  } catch (e) {
    errorMsg.value = e?.message || '注册失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (resendTimer) clearInterval(resendTimer)
})
</script>
