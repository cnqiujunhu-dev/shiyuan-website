<template>
  <div class="auth-page">
    <div class="auth-panel">
      <div class="auth-logo">📦 诸城叙梦</div>
      <div class="form-container">
        <div class="form-title">欢迎回来</div>
        <div class="form-subtitle">输入 QQ 号，使用 QQ 邮箱验证码登录</div>

        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <div v-if="success" class="alert alert-success">{{ success }}</div>

        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label class="form-label">QQ 号</label>
            <div style="display:flex;gap:8px;">
              <input
                v-model="form.qq"
                type="text"
                inputmode="numeric"
                class="form-input"
                :class="{ error: errors.qq }"
                placeholder="请输入 QQ 号"
                autocomplete="off"
                :disabled="codeSent"
              />
              <button v-if="codeSent" type="button" class="btn btn-secondary" @click="resetCodeStep">修改</button>
            </div>
            <div class="form-error" v-if="errors.qq">{{ errors.qq }}</div>
            <div class="text-xs text-muted mt-1">验证码将发送至 {{ qqEmailPreview || 'QQ邮箱' }}</div>
          </div>

          <div v-if="codeSent" class="form-group">
            <label class="form-label">验证码</label>
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
            {{ loading ? (codeSent ? '登录中...' : '发送中...') : (codeSent ? '登录' : '发送验证码') }}
          </button>
        </form>

        <div class="form-link">
          还没有账户？<RouterLink to="/register">立即注册</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { authAPI } from '@/api/index.js'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ qq: '', code: '' })
const errors = reactive({ qq: '', code: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')
const codeSent = ref(false)
const resendSeconds = ref(0)
let resendTimer = null

const qqEmailPreview = computed(() => {
  const qq = form.qq.trim()
  return /^\d{5,12}$/.test(qq) ? `${qq}@qq.com` : ''
})

function validateQq() {
  errors.qq = ''
  if (!/^\d{5,12}$/.test(form.qq.trim())) {
    errors.qq = '请输入正确的 QQ 号'
    return false
  }
  return true
}

function validateCode() {
  errors.code = ''
  if (!/^\d{6}$/.test(form.code.trim())) {
    errors.code = '请输入 6 位验证码'
    return false
  }
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

function resetCodeStep() {
  codeSent.value = false
  form.code = ''
  success.value = ''
  if (resendTimer) clearInterval(resendTimer)
  resendTimer = null
  resendSeconds.value = 0
}

async function sendCode() {
  error.value = ''
  success.value = ''
  if (!validateQq()) return
  loading.value = true
  try {
    await authAPI.sendLoginCode({ qq: form.qq.trim() })
    codeSent.value = true
    success.value = `验证码已发送至 ${qqEmailPreview.value}。`
    startResendCountdown(60)
  } catch (e) {
    error.value = e?.message || '验证码发送失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (!codeSent.value) {
    await sendCode()
    return
  }
  error.value = ''
  if (!validateQq() || !validateCode()) return
  loading.value = true
  try {
    const result = await auth.login(form.qq.trim(), form.code.trim())
    if (result.ok) {
      router.push('/my-assets')
    } else {
      error.value = result.message || '登录失败，请检查验证码'
    }
  } catch (e) {
    error.value = e?.message || '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (resendTimer) clearInterval(resendTimer)
})
</script>

<style scoped>
.auth-panel {
  width: 100%;
  max-width: 420px;
}
</style>
