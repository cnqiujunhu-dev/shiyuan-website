<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">帮助中心</h1>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-nav">
      <button
        :class="['tab-item', { active: activeTab === 'buyback' }]"
        @click="activeTab = 'buyback'; loadBuybackAssets()"
      >素材回购</button>
      <button
        :class="['tab-item', { active: activeTab === 'account' }]"
        @click="activeTab = 'account'"
      >账户设置</button>
    </div>

    <!-- ===== Buyback Tab ===== -->
    <div v-if="activeTab === 'buyback'">
      <div class="card" style="max-width:680px;margin-bottom:24px;">
        <div class="section-title" style="margin-bottom:6px;">素材回购申请</div>
        <p class="text-sm text-muted" style="margin-bottom:14px;">
          VIP 会员每年可对已转让素材发起回购申请，本年度剩余回购次数：
          <strong class="text-primary">{{ buybackRemaining }}</strong> 次
        </p>

        <div v-if="buybackError" class="alert alert-error" style="margin-bottom:12px;">{{ buybackError }}</div>
        <div v-if="buybackSuccess" class="alert" style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:0.875rem;color:#166534;">
          {{ buybackSuccess }}
        </div>

        <!-- 可回购的转让记录 -->
        <div v-if="buybackAssetsLoading" class="loading-wrap" style="padding:20px 0;">
          <div class="spinner"></div>
        </div>
        <div v-else-if="buybackAssets.length === 0" class="empty-state" style="padding:24px 0;">
          <div class="empty-state-desc">暂无已转让的素材记录</div>
        </div>
        <div v-else>
          <div v-for="o in buybackAssets" :key="o._id" class="asset-item" style="margin-bottom:10px;">
            <div class="asset-preview" style="width:56px;height:56px;font-size:1.4rem;">
              <img v-if="o.item_id?.preview_url" :src="o.item_id.preview_url" :alt="o.item_id?.name" />
              <span v-else>🖼️</span>
            </div>
            <div class="asset-info">
              <div class="asset-name">{{ o.item_id?.name || '未知素材' }}</div>
              <div class="asset-meta">
                <span v-if="o.item_id?.artist">{{ o.item_id.artist }}</span>
                <span>转出于 {{ formatDate(o.occurred_at) }}</span>
              </div>
            </div>
            <div style="flex-shrink:0">
              <button
                class="btn btn-secondary btn-sm"
                :disabled="buybackRemaining <= 0"
                @click="openBuybackModal(o)"
              >申请回购</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Buyback History -->
      <div class="card" style="max-width:680px;">
        <div class="section-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div class="section-title">回购申请记录</div>
          <button class="btn btn-ghost btn-sm" @click="loadBuybackHistory">刷新</button>
        </div>
        <div class="loading-wrap" v-if="buybackHistoryLoading"><div class="spinner"></div></div>
        <div class="empty-state" v-else-if="buybackHistory.length === 0" style="padding:24px 0;">
          <div class="empty-state-desc">暂无回购记录</div>
        </div>
        <div v-else style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
            <thead>
              <tr style="background:#f9fafb;border-bottom:2px solid var(--border);">
                <th style="padding:8px 14px;text-align:left;font-weight:600;">素材名称</th>
                <th style="padding:8px 14px;text-align:left;font-weight:600;">回购原因</th>
                <th style="padding:8px 14px;text-align:left;font-weight:600;">状态</th>
                <th style="padding:8px 14px;text-align:left;font-weight:600;">申请时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in buybackHistory" :key="item._id" style="border-bottom:1px solid var(--border);">
                <td style="padding:8px 14px;">{{ item.payload?.item_name || '-' }}</td>
                <td style="padding:8px 14px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.payload?.reason || '-' }}</td>
                <td style="padding:8px 14px;">
                  <span class="badge" :class="statusBadgeClass(item.status)">{{ statusLabel(item.status) }}</span>
                </td>
                <td style="padding:8px 14px;white-space:nowrap;">{{ formatDate(item.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Buyback Modal -->
      <Teleport to="body">
        <div v-if="buybackModal.show" class="modal-overlay" @click.self="buybackModal.show = false">
          <div class="modal">
            <div class="modal-header">
              <span class="modal-title">申请回购</span>
              <button class="modal-close" @click="buybackModal.show = false">✕</button>
            </div>
            <p class="text-sm text-muted" style="margin-bottom:14px;">
              素材：<strong>{{ buybackModal.ownership?.item_id?.name }}</strong>
            </p>
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">回购原因（可选）</label>
              <textarea v-model="buybackModal.reason" class="form-input" rows="3" placeholder="请简述回购原因..." style="resize:vertical;"></textarea>
            </div>
            <div v-if="buybackModal.error" class="alert alert-error" style="margin-bottom:12px;">{{ buybackModal.error }}</div>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="buybackModal.show = false">取消</button>
              <button class="btn btn-primary" :disabled="buybackModal.loading" @click="submitBuyback">
                {{ buybackModal.loading ? '提交中...' : '提交申请' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>

    <!-- ===== Account Settings Tab ===== -->
    <div v-if="activeTab === 'account'">
      <!-- Email Binding Section -->
      <div class="card" style="max-width:520px;margin-bottom:24px;">
        <div class="section-title" style="margin-bottom:14px;">邮箱绑定与验证</div>

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <span class="text-sm text-muted">当前邮箱：</span>
          <span style="font-weight:500;">{{ auth.user?.email || '未绑定' }}</span>
          <span v-if="!auth.user?.email" class="badge badge-default">未绑定</span>
          <span v-else-if="auth.user?.email_verified_at" class="badge badge-success">已验证</span>
          <span v-else class="badge badge-warning">未验证</span>
        </div>

        <div v-if="emailError" class="alert alert-error" style="margin-bottom:12px;">{{ emailError }}</div>
        <div v-if="emailSuccess" class="alert" style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:0.875rem;color:#166534;">
          {{ emailSuccess }}
        </div>

        <!-- Step 1: Input email + send code -->
        <div v-if="!emailCodeSent">
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">
              {{ auth.user?.email ? '更换邮箱' : '输入邮箱' }}
            </label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input
                v-model="emailInput"
                type="email"
                class="form-input"
                :placeholder="auth.user?.email || '请输入邮箱地址'"
                style="flex:1;max-width:280px;"
              />
              <button
                class="btn btn-primary"
                @click="sendVerifyEmail"
                :disabled="emailLoading || !emailInput.trim()"
              >
                {{ emailLoading ? '发送中...' : '发送验证码' }}
              </button>
            </div>
            <span class="form-hint" style="display:block;margin-top:4px;">输入邮箱后点击发送，验证码将发至该邮箱</span>
          </div>
        </div>

        <!-- Step 2: Enter verification code -->
        <div v-else>
          <p class="text-sm text-muted mb-2">验证码已发送至 <strong>{{ emailSentTo }}</strong>，请在 10 分钟内输入。</p>
          <div style="display:flex;gap:8px;align-items:center;">
            <input
              v-model="emailVerifyCode"
              type="text"
              class="form-input"
              placeholder="请输入 6 位验证码"
              style="flex:1;max-width:180px;"
              maxlength="6"
            />
            <button
              class="btn btn-primary"
              @click="submitVerifyEmail"
              :disabled="emailLoading || !emailVerifyCode"
            >
              {{ emailLoading ? '验证中...' : '验证' }}
            </button>
            <button class="btn btn-ghost" @click="emailCodeSent = false">取消</button>
          </div>
        </div>
      </div>

      <!-- Password Change Section -->
      <div class="card" style="max-width:520px;">
        <div class="section-title" style="margin-bottom:14px;">修改密码</div>

        <div v-if="pwdError" class="alert alert-error" style="margin-bottom:12px;">{{ pwdError }}</div>
        <div v-if="pwdSuccess" class="alert" style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:0.875rem;color:#166534;">
          {{ pwdSuccess }}
        </div>

        <form @submit.prevent="submitPasswordChange">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">当前密码</label>
            <input
              v-model="pwdForm.old_password"
              type="password"
              class="form-input"
              placeholder="请输入当前密码"
              required
              autocomplete="current-password"
            />
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">新密码</label>
            <input
              v-model="pwdForm.new_password"
              type="password"
              class="form-input"
              placeholder="请输入新密码（至少 6 位）"
              required
              minlength="6"
              autocomplete="new-password"
            />
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">确认新密码</label>
            <input
              v-model="pwdForm.confirm_password"
              type="password"
              class="form-input"
              placeholder="请再次输入新密码"
              required
              autocomplete="new-password"
            />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="pwdLoading">
            {{ pwdLoading ? '修改中...' : '修改密码' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, inject, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useUserStore } from '@/stores/user.js'
import { applicationsAPI, authAPI, assetsAPI } from '@/api/index.js'

const auth = useAuthStore()
const userStore = useUserStore()
const addToast = inject('addToast')

const activeTab = ref('buyback')
const buybackRemaining = computed(() => (
  userStore.summary?.buyback_remaining ??
  auth.user?.buyback_remaining ??
  0
))

// ===== Buyback =====
const buybackAssets = ref([])
const buybackAssetsLoading = ref(false)
const buybackHistory = ref([])
const buybackHistoryLoading = ref(false)
const buybackError = ref('')
const buybackSuccess = ref('')
const buybackModal = reactive({ show: false, ownership: null, reason: '', loading: false, error: '' })

async function loadBuybackAssets() {
  buybackAssetsLoading.value = true
  try {
    const res = await assetsAPI.getMyAssets({ acquisition_type: 'transfer_out', limit: 50 })
    buybackAssets.value = res.ownerships || []
  } catch { /* silent */ } finally {
    buybackAssetsLoading.value = false
  }
}

async function loadBuybackHistory() {
  buybackHistoryLoading.value = true
  try {
    const res = await applicationsAPI.getMyApplications({ type: 'buyback' })
    buybackHistory.value = res.applications || []
  } catch { /* silent */ } finally {
    buybackHistoryLoading.value = false
  }
}

function openBuybackModal(o) {
  buybackModal.show = true
  buybackModal.ownership = o
  buybackModal.reason = ''
  buybackModal.error = ''
}

async function submitBuyback() {
  buybackModal.loading = true
  buybackModal.error = ''
  try {
    const res = await applicationsAPI.buyback({
      ownership_id: buybackModal.ownership._id,
      reason: buybackModal.reason.trim()
    })
    if (res.message && !res.error) {
      buybackSuccess.value = '回购申请已提交，请等待管理员审核。'
      addToast('回购申请已提交', 'success')
      buybackModal.show = false
      loadBuybackHistory()
    } else {
      buybackModal.error = res.message || '提交失败'
    }
  } catch (e) {
    buybackModal.error = e?.message || '提交失败，请稍后重试'
  } finally {
    buybackModal.loading = false
  }
}

// ===== Account Settings =====
const emailLoading = ref(false)
const emailError = ref('')
const emailSuccess = ref('')
const emailCodeSent = ref(false)
const emailVerifyCode = ref('')
const emailInput = ref('')
const emailSentTo = ref('')

const pwdForm = reactive({ old_password: '', new_password: '', confirm_password: '' })
const pwdLoading = ref(false)
const pwdError = ref('')
const pwdSuccess = ref('')

async function sendVerifyEmail() {
  const email = emailInput.value.trim()
  if (!email) { emailError.value = '请输入邮箱地址'; return }
  emailError.value = ''
  emailSuccess.value = ''
  emailLoading.value = true
  try {
    const res = await authAPI.sendVerifyEmail(email)
    if (res.message && !res.error) {
      emailCodeSent.value = true
      emailSentTo.value = email
      addToast('验证码已发送', 'success')
    } else {
      emailError.value = res.message || res.error || '发送失败，请稍后重试'
    }
  } catch (e) {
    emailError.value = e?.message || '发送失败，请稍后重试'
  } finally {
    emailLoading.value = false
  }
}

async function submitVerifyEmail() {
  if (!emailVerifyCode.value.trim()) return
  emailError.value = ''
  emailSuccess.value = ''
  emailLoading.value = true
  try {
    const res = await authAPI.verifyEmail(emailVerifyCode.value.trim())
    if (res.message && !res.error) {
      emailSuccess.value = '邮箱绑定成功！'
      emailCodeSent.value = false
      emailVerifyCode.value = ''
      addToast('邮箱绑定成功', 'success')
      if (res.user) auth.updateUser(res.user)
    } else {
      emailError.value = res.message || res.error || '验证失败'
    }
  } catch (e) {
    emailError.value = e?.message || '验证失败，请稍后重试'
  } finally {
    emailLoading.value = false
  }
}

async function submitPasswordChange() {
  pwdError.value = ''
  pwdSuccess.value = ''
  if (!pwdForm.old_password) { pwdError.value = '请输入当前密码'; return }
  if (!pwdForm.new_password || pwdForm.new_password.length < 6) { pwdError.value = '新密码至少 6 位'; return }
  if (pwdForm.new_password !== pwdForm.confirm_password) { pwdError.value = '两次输入的新密码不一致'; return }

  pwdLoading.value = true
  try {
    const res = await authAPI.changePassword({
      old_password: pwdForm.old_password,
      new_password: pwdForm.new_password,
    })
    if (res.message && !res.error) {
      pwdSuccess.value = '密码修改成功！'
      pwdForm.old_password = ''
      pwdForm.new_password = ''
      pwdForm.confirm_password = ''
      addToast('密码修改成功', 'success')
    } else {
      pwdError.value = res.message || res.error || '修改失败'
    }
  } catch (e) {
    pwdError.value = e?.message || '修改失败，请稍后重试'
  } finally {
    pwdLoading.value = false
  }
}

// ===== Helpers =====
function statusLabel(status) {
  const map = { pending: '审核中', approved: '已通过', rejected: '已拒绝' }
  return map[status] || status || '未知'
}

function statusBadgeClass(status) {
  const map = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' }
  return map[status] || 'badge-default'
}

function formatDate(val) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

onMounted(() => {
  userStore.fetchSummary()
  loadBuybackAssets()
  loadBuybackHistory()
})
</script>
