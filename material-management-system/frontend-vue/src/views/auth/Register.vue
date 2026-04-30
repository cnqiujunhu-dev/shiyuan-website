<template>
  <div class="auth-page">
    <div class="register-wrap">
      <div class="auth-logo">📦 诸城叙梦</div>
      <div class="form-container register-card">
        <div class="form-title">创建账户</div>
        <div class="form-subtitle">{{ qqVerified ? '登记身份后提交管理员审核' : '先验证 QQ 邮箱，再登记身份' }}</div>

        <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
        <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

        <form v-if="!qqVerified && !registrationComplete" @submit.prevent="handleVerifyStep">
          <div class="form-group">
            <label class="form-label">QQ 号</label>
            <div style="display:flex;gap:8px;">
              <input
                v-model="qqForm.qq"
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
              v-model="qqForm.code"
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
            {{ loading ? (codeSent ? '验证中...' : '发送中...') : (codeSent ? '验证 QQ' : '发送验证码') }}
          </button>
        </form>

        <form v-else-if="!registrationComplete" @submit.prevent="openConfirm">
          <div class="verified-strip">
            <span>已验证 QQ</span>
            <strong>{{ qqForm.qq }}</strong>
          </div>

          <div class="identity-header">
            <label class="form-label">身份登记</label>
            <button type="button" class="btn btn-secondary btn-sm" @click="addIdentity">新增副身份</button>
          </div>

          <div v-for="(identity, index) in identities" :key="identity.localId" class="identity-card">
            <div class="identity-card-head">
              <span>{{ index === 0 ? '主身份' : `副身份 ${index}` }}</span>
              <button v-if="index > 0" type="button" class="remove-btn" @click="removeIdentity(index)">&times;</button>
            </div>
            <div class="identity-grid">
              <input
                v-model="identity.nickname"
                type="text"
                class="form-input"
                :class="{ error: identity.errors.nickname }"
                placeholder="圈名 ID"
                maxlength="50"
              />
              <select v-model="identity.role" class="form-input" :class="{ error: identity.errors.role }">
                <option value="">身份</option>
                <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
              </select>
              <select v-model="identity.platform" class="form-input" :class="{ error: identity.errors.platform }">
                <option value="">平台</option>
                <option v-for="platform in platformOptions" :key="platform" :value="platform">{{ platform }}</option>
              </select>
            </div>
            <div v-if="identity.role === '文游作者'" class="form-group mt-2">
              <label class="form-label text-xs">文游作者 UID</label>
              <input
                v-model="identity.uid"
                type="text"
                class="form-input"
                :class="{ error: identity.errors.uid }"
                placeholder="请输入该平台作品/作者 UID"
                maxlength="50"
              />
            </div>
            <div v-if="identityError(identity)" class="form-error mt-2">{{ identityError(identity) }}</div>
          </div>

          <button type="submit" class="form-submit" :disabled="loading">
            {{ loading ? '提交中...' : '提交审核' }}
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

const roleOptions = ['文游作者', '小说作者', '非重氪独立游戏作者', '美工']
const platformOptions = ['全平台', '橙光', '易次元', '闪艺', '晋江', '番茄', '微博', '小红书', '抖音', '快手']

const qqForm = reactive({ qq: '', code: '' })
const errors = reactive({ qq: '', code: '' })
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const registrationComplete = ref(false)
const codeSent = ref(false)
const qqVerified = ref(false)
const resendSeconds = ref(0)
const confirmModal = ref(false)
let resendTimer = null

const identities = ref([createIdentity(true)])

const qqEmailPreview = computed(() => {
  const qq = qqForm.qq.trim()
  return /^\d{5,12}$/.test(qq) ? `${qq}@qq.com` : ''
})

function createIdentity(isPrimary = false) {
  return {
    localId: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    is_primary: isPrimary,
    nickname: '',
    role: '',
    platform: '',
    uid: '',
    errors: { nickname: '', role: '', platform: '', uid: '' }
  }
}

function validateQq() {
  errors.qq = ''
  if (!/^\d{5,12}$/.test(qqForm.qq.trim())) {
    errors.qq = '请输入正确的 QQ 号'
    return false
  }
  return true
}

function validateCode() {
  errors.code = ''
  if (!/^\d{6}$/.test(qqForm.code.trim())) {
    errors.code = '请输入 6 位验证码'
    return false
  }
  return true
}

function clearIdentityErrors(identity) {
  identity.errors.nickname = ''
  identity.errors.role = ''
  identity.errors.platform = ''
  identity.errors.uid = ''
}

function validateIdentity(identity) {
  clearIdentityErrors(identity)
  let valid = true
  if (!identity.nickname.trim()) {
    identity.errors.nickname = '请输入圈名 ID'
    valid = false
  } else if (/[<>\r\n\t]/.test(identity.nickname)) {
    identity.errors.nickname = '圈名 ID 不能包含换行或尖括号'
    valid = false
  }
  if (!identity.role) {
    identity.errors.role = '请选择身份'
    valid = false
  }
  if (!identity.platform) {
    identity.errors.platform = '请选择平台'
    valid = false
  }
  if (identity.role === '文游作者' && !identity.uid.trim()) {
    identity.errors.uid = '请填写文游作者 UID'
    valid = false
  } else if (/[<>\r\n\t]/.test(identity.uid)) {
    identity.errors.uid = 'UID 不能包含换行或尖括号'
    valid = false
  }
  return valid
}

function validateIdentities() {
  let valid = identities.value.length > 0
  identities.value.forEach((identity) => {
    if (!validateIdentity(identity)) valid = false
  })
  return valid
}

function identityError(identity) {
  return identity.errors.nickname || identity.errors.role || identity.errors.platform || identity.errors.uid
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
  qqForm.code = ''
  successMsg.value = ''
  if (resendTimer) clearInterval(resendTimer)
  resendTimer = null
  resendSeconds.value = 0
}

async function sendCode() {
  errorMsg.value = ''
  successMsg.value = ''
  if (!validateQq()) return
  loading.value = true
  try {
    await authAPI.sendRegisterCode({ qq: qqForm.qq.trim() })
    codeSent.value = true
    successMsg.value = `验证码已发送至 ${qqEmailPreview.value}。`
    startResendCountdown(60)
  } catch (e) {
    errorMsg.value = e?.message || '验证码发送失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function handleVerifyStep() {
  if (!codeSent.value) {
    await sendCode()
    return
  }
  errorMsg.value = ''
  if (!validateQq() || !validateCode()) return
  loading.value = true
  try {
    const res = await authAPI.verifyRegisterCode({ qq: qqForm.qq.trim(), code: qqForm.code.trim() })
    qqVerified.value = true
    successMsg.value = res.message || 'QQ 邮箱验证成功，请继续登记身份。'
  } catch (e) {
    errorMsg.value = e?.message || '验证失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function addIdentity() {
  identities.value.push(createIdentity(false))
}

function removeIdentity(index) {
  identities.value.splice(index, 1)
}

function openConfirm() {
  errorMsg.value = ''
  if (!validateIdentities()) return
  confirmModal.value = true
}

async function submitRegister() {
  errorMsg.value = ''
  if (!validateIdentities()) return
  loading.value = true
  try {
    const payload = {
      qq: qqForm.qq.trim(),
      identities: identities.value.map((identity, index) => ({
        role: identity.role,
        platform: identity.platform,
        nickname: identity.nickname.trim(),
        uid: identity.role === '文游作者' ? identity.uid.trim() : '',
        is_primary: index === 0
      }))
    }
    const res = await authAPI.register(payload)
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
  max-width: 640px;
}

.register-card {
  max-width: 640px;
}

.verified-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: var(--radius);
  padding: 10px 14px;
  margin-bottom: 18px;
}

.identity-header,
.identity-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.identity-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  margin-bottom: 12px;
  background: #fff;
}

.identity-card-head {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 10px;
}

.identity-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 10px;
}

.remove-btn {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
}

@media (max-width: 640px) {
  .identity-grid {
    grid-template-columns: 1fr;
  }
}
</style>
