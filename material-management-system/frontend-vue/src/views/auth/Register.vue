<template>
  <div class="auth-page">
    <div class="register-wrap">
      <div class="auth-logo">📦 诸城叙梦</div>
      <div class="form-container register-card">
        <div class="form-title">创建账户</div>
        <div class="form-subtitle">填写 QQ 号与主身份，验证后提交管理员审核</div>

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
            <label class="form-label">主 QQ</label>
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
              <button
                v-if="codeSent"
                type="button"
                class="btn btn-secondary"
                style="white-space:nowrap;"
                @click="resetCodeStep"
              >
                修改
              </button>
            </div>
            <div class="form-error" v-if="errors.qq">{{ errors.qq }}</div>
            <div class="text-xs text-muted mt-1">验证码将发送至 {{ qqEmailPreview || 'QQ邮箱' }}</div>
          </div>

          <div class="form-group">
            <label class="form-label">主身份</label>
            <div class="identity-grid">
              <select v-model="form.identity.role" class="form-input" :class="{ error: errors.role }">
                <option value="">职业</option>
                <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
              </select>
              <select v-model="form.identity.platform" class="form-input" :class="{ error: errors.platform }">
                <option value="">平台</option>
                <option v-for="platform in platformOptions" :key="platform" :value="platform">{{ platform }}</option>
              </select>
            </div>
            <input
              v-model="form.identity.nickname"
              type="text"
              class="form-input mt-2"
              :class="{ error: errors.nickname }"
              placeholder="圈名"
              maxlength="50"
            />
            <div class="form-error" v-if="identityError">{{ identityError }}</div>
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
            {{ loading ? (codeSent ? '提交中...' : '发送中...') : (codeSent ? '提交审核' : '发送验证码') }}
          </button>
        </form>

        <div class="form-link">
          已有账户？<RouterLink to="/login">立即登录</RouterLink>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="confirmModal" class="modal-overlay" @click.self="confirmModal = false">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">确认提交审核</span>
            <button class="modal-close" @click="confirmModal = false">&times;</button>
          </div>
          <div class="alert alert-warning">
            保存信息后将自动提交管理员审核。审核期间账号不可登录，审核通过后会通过邮件通知。
          </div>
          <p class="text-sm text-muted">
            初次审核通常会在 24-48 小时内完成，需加急可联系群管理。非初次审核不可加急。
          </p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="confirmModal = false">取消</button>
            <button class="btn btn-primary" :disabled="loading" @click="submitRegister">
              {{ loading ? '提交中...' : '确认提交' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onBeforeUnmount } from 'vue'
import { authAPI } from '@/api/index.js'

const roleOptions = ['美工', '画师', '文游作者', '小说作者', '美化']
const platformOptions = ['全平台', '橙光', '易次元', '闪艺', '番茄', '晋江', '小红书', '微博', '快手', '抖音', '米画师', '画加']

const form = reactive({
  username: '',
  qq: '',
  password: '',
  confirmPassword: '',
  code: '',
  identity: { role: '', platform: '', nickname: '' }
})
const errors = reactive({
  username: '',
  qq: '',
  password: '',
  confirmPassword: '',
  code: '',
  role: '',
  platform: '',
  nickname: ''
})
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const registrationComplete = ref(false)
const codeSent = ref(false)
const resendSeconds = ref(0)
const confirmModal = ref(false)
let resendTimer = null

const qqEmailPreview = computed(() => {
  const qq = form.qq.trim()
  return /^\d{5,12}$/.test(qq) ? `${qq}@qq.com` : ''
})

const identityError = computed(() => errors.role || errors.platform || errors.nickname)

function clearErrors() {
  Object.keys(errors).forEach((key) => {
    errors[key] = ''
  })
}

function validateAccount() {
  clearErrors()
  let valid = true
  const username = form.username.trim()
  const qq = form.qq.trim()
  const nickname = form.identity.nickname.trim()
  if (username.length < 2 || username.length > 30) {
    errors.username = '自定义 ID 长度须为 2-30 位'
    valid = false
  } else if (!/^[^\r\n\t<>]+$/.test(username)) {
    errors.username = '自定义 ID 不能包含换行或尖括号'
    valid = false
  }
  if (!/^\d{5,12}$/.test(qq)) {
    errors.qq = '请输入正确的 QQ 号'
    valid = false
  }
  if (!form.identity.role) {
    errors.role = '请选择职业'
    valid = false
  }
  if (!form.identity.platform) {
    errors.platform = '请选择平台'
    valid = false
  }
  if (!nickname) {
    errors.nickname = '请输入圈名'
    valid = false
  } else if (/[<>\r\n\t]/.test(nickname)) {
    errors.nickname = '圈名不能包含换行或尖括号'
    valid = false
  }
  if (form.password.length < 6) {
    errors.password = '密码至少 6 位'
    valid = false
  }
  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = '两次输入的密码不一致'
    valid = false
  }
  return valid
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

function resetCodeStep() {
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
    await authAPI.sendRegisterCode({ username: form.username.trim(), qq: form.qq.trim() })
    codeSent.value = true
    successMsg.value = `验证码已发送至 ${qqEmailPreview.value}，请在 10 分钟内提交审核。`
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
  confirmModal.value = true
}

async function submitRegister() {
  errorMsg.value = ''
  if (!validateAccount() || !validateCode()) return
  loading.value = true
  try {
    const res = await authAPI.register({
      username: form.username.trim(),
      qq: form.qq.trim(),
      password: form.password,
      code: form.code.trim(),
      identity: {
        role: form.identity.role,
        platform: form.identity.platform,
        nickname: form.identity.nickname.trim()
      }
    })
    confirmModal.value = false
    registrationComplete.value = true
    successMsg.value = res.message || '注册申请已提交，审核通过后会发送邮件通知您登录。'
  } catch (e) {
    confirmModal.value = false
    errorMsg.value = e?.message || '注册失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (resendTimer) clearInterval(resendTimer)
})
</script>

<style scoped>
.register-wrap {
  width: 100%;
  max-width: 520px;
}

.register-card {
  max-width: 520px;
}

.identity-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

@media (max-width: 480px) {
  .identity-grid {
    grid-template-columns: 1fr;
  }
}
</style>
