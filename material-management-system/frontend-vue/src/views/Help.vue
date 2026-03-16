<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">帮助中心</h1>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-nav">
      <button
        :class="['tab-item', { active: activeTab === 'platform' }]"
        @click="activeTab = 'platform'"
      >平台变更</button>
      <button
        :class="['tab-item', { active: activeTab === 'print' }]"
        @click="activeTab = 'print'"
      >自印报备</button>
      <button
        :class="['tab-item', { active: activeTab === 'account' }]"
        @click="activeTab = 'account'"
      >账户设置</button>
    </div>

    <!-- ===== Platform Change Tab ===== -->
    <div v-if="activeTab === 'platform'">
      <div class="info-grid" style="margin-bottom:20px;">
        <div class="info-card">
          <div class="info-card-label">当前平台</div>
          <div class="info-card-value">{{ userStore.summary?.platform || auth.user?.platform || '-' }}</div>
        </div>
        <div class="info-card">
          <div class="info-card-label">平台 ID</div>
          <div class="info-card-value">{{ userStore.summary?.platform_id || auth.user?.platform_id || '未设置' }}</div>
        </div>
      </div>

      <div class="card" style="max-width:540px;margin-bottom:24px;">
        <div class="section-title" style="margin-bottom:14px;">申请平台变更</div>

        <div class="alert" style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:0.875rem;color:#92400e;">
          ⚠️ 平台变更每年仅限一次，需经管理员审核后方可生效，请谨慎申请。
        </div>

        <div v-if="platformError" class="alert alert-error" style="margin-bottom:12px;">{{ platformError }}</div>
        <div v-if="platformSuccess" class="alert" style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:0.875rem;color:#166534;">
          {{ platformSuccess }}
        </div>

        <form @submit.prevent="submitPlatformChange" v-if="!platformSuccess">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">新平台</label>
            <select v-model="platformForm.new_platform" class="form-input" required>
              <option value="">请选择目标平台</option>
              <option value="易次元">易次元 (yicicen)</option>
              <option value="橙光">橙光 (orangelight)</option>
              <option value="闪艺">闪艺 (shanyi)</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">变更原因（可选）</label>
            <textarea
              v-model="platformForm.reason"
              class="form-input"
              rows="3"
              placeholder="请简述变更原因..."
              style="resize:vertical;"
            ></textarea>
          </div>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="platformLoading || !platformForm.new_platform"
          >
            {{ platformLoading ? '提交中...' : '提交申请' }}
          </button>
        </form>
      </div>

      <!-- Platform Change History -->
      <div class="card">
        <div class="section-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div class="section-title">申请历史</div>
          <button class="btn btn-ghost btn-sm" @click="loadPlatformHistory">刷新</button>
        </div>
        <div class="loading-wrap" v-if="platformHistoryLoading">
          <div class="spinner"></div>
        </div>
        <div class="empty-state" v-else-if="platformHistory.length === 0" style="padding:24px 0;">
          <div class="empty-state-desc">暂无申请记录</div>
        </div>
        <div v-else style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
            <thead>
              <tr style="background:#f9fafb;border-bottom:2px solid var(--border);">
                <th style="padding:8px 14px;text-align:left;font-weight:600;">新平台</th>
                <th style="padding:8px 14px;text-align:left;font-weight:600;">原因</th>
                <th style="padding:8px 14px;text-align:left;font-weight:600;">状态</th>
                <th style="padding:8px 14px;text-align:left;font-weight:600;">申请时间</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in platformHistory"
                :key="item._id"
                style="border-bottom:1px solid var(--border);"
              >
                <td style="padding:8px 14px;">{{ item.new_platform || '-' }}</td>
                <td style="padding:8px 14px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.reason || '-' }}</td>
                <td style="padding:8px 14px;">
                  <span class="badge" :class="statusBadgeClass(item.status)">{{ statusLabel(item.status) }}</span>
                </td>
                <td style="padding:8px 14px;white-space:nowrap;">{{ formatDate(item.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ===== Print Report Tab ===== -->
    <div v-if="activeTab === 'print'">
      <div class="card" style="max-width:600px;margin-bottom:24px;">
        <div class="section-title" style="margin-bottom:14px;">自印报备申请</div>

        <div v-if="printError" class="alert alert-error" style="margin-bottom:12px;">{{ printError }}</div>
        <div v-if="printSuccess" class="alert" style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:0.875rem;color:#166534;">
          {{ printSuccess }}
        </div>

        <form @submit.prevent="submitPrintReport" v-if="!printSuccess">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">素材名称 / ID</label>
            <input
              v-model="printForm.item_name"
              type="text"
              class="form-input"
              placeholder="请输入素材名称或 ID"
              required
            />
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">衍生类型</label>
            <select v-model="printForm.derivative_type" class="form-input" required>
              <option value="">请选择</option>
              <option value="merchandise">实物周边 (merchandise)</option>
              <option value="photography">摄影 (photography)</option>
              <option value="other">其他 (other)</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">印制份数（最多 30 份）</label>
            <input
              v-model.number="printForm.copies"
              type="number"
              class="form-input"
              min="1"
              max="30"
              placeholder="请输入份数"
              required
            />
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:6px;">用途说明</label>
            <textarea
              v-model="printForm.description"
              class="form-input"
              rows="3"
              placeholder="请说明印制用途，例如自用、展会摆摊等..."
              required
              style="resize:vertical;"
            ></textarea>
          </div>
          <button type="submit" class="btn btn-primary" :disabled="printLoading">
            {{ printLoading ? '提交中...' : '提交报备' }}
          </button>
        </form>
        <button v-else class="btn btn-ghost btn-sm mt-3" @click="resetPrintForm">再次报备</button>
      </div>

      <!-- Print Report History -->
      <div class="card">
        <div class="section-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div class="section-title">报备历史</div>
          <button class="btn btn-ghost btn-sm" @click="loadPrintHistory">刷新</button>
        </div>
        <div class="loading-wrap" v-if="printHistoryLoading">
          <div class="spinner"></div>
        </div>
        <div class="empty-state" v-else-if="printHistory.length === 0" style="padding:24px 0;">
          <div class="empty-state-desc">暂无报备记录</div>
        </div>
        <div v-else style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
            <thead>
              <tr style="background:#f9fafb;border-bottom:2px solid var(--border);">
                <th style="padding:8px 14px;text-align:left;font-weight:600;">素材名称</th>
                <th style="padding:8px 14px;text-align:left;font-weight:600;">衍生类型</th>
                <th style="padding:8px 14px;text-align:left;font-weight:600;">份数</th>
                <th style="padding:8px 14px;text-align:left;font-weight:600;">状态</th>
                <th style="padding:8px 14px;text-align:left;font-weight:600;">申请时间</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in printHistory"
                :key="item._id"
                style="border-bottom:1px solid var(--border);"
              >
                <td style="padding:8px 14px;">{{ item.item_name || '-' }}</td>
                <td style="padding:8px 14px;">{{ derivativeTypeLabel(item.derivative_type) }}</td>
                <td style="padding:8px 14px;">{{ item.copies ?? '-' }}</td>
                <td style="padding:8px 14px;">
                  <span class="badge" :class="statusBadgeClass(item.status)">{{ statusLabel(item.status) }}</span>
                </td>
                <td style="padding:8px 14px;white-space:nowrap;">{{ formatDate(item.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ===== Account Settings Tab ===== -->
    <div v-if="activeTab === 'account'">
      <!-- Email Binding Section -->
      <div class="card" style="max-width:520px;margin-bottom:24px;">
        <div class="section-title" style="margin-bottom:14px;">邮箱绑定</div>

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <span class="text-sm text-muted">当前邮箱：</span>
          <span style="font-weight:500;">{{ auth.user?.email || '未绑定' }}</span>
          <span v-if="!auth.user?.email" class="badge badge-default">未绑定</span>
          <span v-else class="badge badge-success">已绑定</span>
        </div>

        <div v-if="emailError" class="alert alert-error" style="margin-bottom:12px;">{{ emailError }}</div>
        <div v-if="emailSuccess" class="alert" style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:0.875rem;color:#166534;">
          {{ emailSuccess }}
        </div>

        <div v-if="!emailCodeSent">
          <button
            class="btn btn-primary"
            @click="sendVerifyEmail"
            :disabled="emailLoading"
          >
            {{ emailLoading ? '发送中...' : (auth.user?.email ? '重新绑定邮箱' : '发送验证码') }}
          </button>
        </div>
        <div v-else>
          <p class="text-sm text-muted mb-2">验证码已发送至您的邮箱，请在 10 分钟内输入。</p>
          <div style="display:flex;gap:8px;align-items:center;">
            <input
              v-model="emailVerifyCode"
              type="text"
              class="form-input"
              placeholder="请输入验证码"
              style="flex:1;max-width:180px;"
              maxlength="8"
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
import { ref, reactive, inject, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useUserStore } from '@/stores/user.js'
import { applicationsAPI, authAPI } from '@/api/index.js'

const auth = useAuthStore()
const userStore = useUserStore()
const addToast = inject('addToast')

const activeTab = ref('platform')

// ===== Platform Change =====
const platformForm = reactive({ new_platform: '', reason: '' })
const platformLoading = ref(false)
const platformError = ref('')
const platformSuccess = ref('')
const platformHistory = ref([])
const platformHistoryLoading = ref(false)

async function submitPlatformChange() {
  platformError.value = ''
  if (!platformForm.new_platform) {
    platformError.value = '请选择目标平台'
    return
  }
  platformLoading.value = true
  try {
    const data = { new_platform: platformForm.new_platform }
    if (platformForm.reason.trim()) data.reason = platformForm.reason.trim()
    const res = await applicationsAPI.platformChange(data)
    if (res.message && !res.error) {
      platformSuccess.value = '平台变更申请已提交，请等待管理员审核。'
      addToast('申请已提交', 'success')
      loadPlatformHistory()
    } else {
      platformError.value = res.message || res.error || '提交失败，请稍后重试'
    }
  } catch (e) {
    platformError.value = '网络错误，请稍后重试'
  } finally {
    platformLoading.value = false
  }
}

async function loadPlatformHistory() {
  platformHistoryLoading.value = true
  try {
    const res = await applicationsAPI.getMyApplications({ type: 'platform_change' })
    platformHistory.value = res.applications || res.data || []
  } catch (e) {
    // silent
  } finally {
    platformHistoryLoading.value = false
  }
}

// ===== Print Report =====
const printForm = reactive({
  item_name: '',
  derivative_type: '',
  copies: '',
  description: '',
})
const printLoading = ref(false)
const printError = ref('')
const printSuccess = ref('')
const printHistory = ref([])
const printHistoryLoading = ref(false)

async function submitPrintReport() {
  printError.value = ''
  if (!printForm.item_name.trim()) { printError.value = '请输入素材名称或 ID'; return }
  if (!printForm.derivative_type) { printError.value = '请选择衍生类型'; return }
  const copies = Number(printForm.copies)
  if (!copies || copies < 1 || copies > 30) { printError.value = '份数须在 1~30 之间'; return }
  if (!printForm.description.trim()) { printError.value = '请填写用途说明'; return }

  printLoading.value = true
  try {
    const res = await applicationsAPI.printReport({
      item_name: printForm.item_name.trim(),
      derivative_type: printForm.derivative_type,
      copies,
      description: printForm.description.trim(),
    })
    if (res.message && !res.error) {
      printSuccess.value = '自印报备申请已提交，请等待管理员审核。'
      addToast('报备申请已提交', 'success')
      loadPrintHistory()
    } else {
      printError.value = res.message || res.error || '提交失败，请稍后重试'
    }
  } catch (e) {
    printError.value = '网络错误，请稍后重试'
  } finally {
    printLoading.value = false
  }
}

function resetPrintForm() {
  printForm.item_name = ''
  printForm.derivative_type = ''
  printForm.copies = ''
  printForm.description = ''
  printSuccess.value = ''
  printError.value = ''
}

async function loadPrintHistory() {
  printHistoryLoading.value = true
  try {
    const res = await applicationsAPI.getMyApplications({ type: 'print_report' })
    printHistory.value = res.applications || res.data || []
  } catch (e) {
    // silent
  } finally {
    printHistoryLoading.value = false
  }
}

// ===== Account Settings =====
const emailLoading = ref(false)
const emailError = ref('')
const emailSuccess = ref('')
const emailCodeSent = ref(false)
const emailVerifyCode = ref('')

const pwdForm = reactive({ old_password: '', new_password: '', confirm_password: '' })
const pwdLoading = ref(false)
const pwdError = ref('')
const pwdSuccess = ref('')

async function sendVerifyEmail() {
  emailError.value = ''
  emailSuccess.value = ''
  emailLoading.value = true
  try {
    const res = await authAPI.sendVerifyEmail()
    if (res.message && !res.error) {
      emailCodeSent.value = true
      addToast('验证码已发送', 'success')
    } else {
      emailError.value = res.message || res.error || '发送失败，请稍后重试'
    }
  } catch (e) {
    emailError.value = '网络错误，请稍后重试'
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
      emailError.value = res.message || res.error || '验证失败，请检查验证码是否正确'
    }
  } catch (e) {
    emailError.value = '网络错误，请稍后重试'
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
      pwdError.value = res.message || res.error || '修改失败，请检查当前密码是否正确'
    }
  } catch (e) {
    pwdError.value = '网络错误，请稍后重试'
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

function derivativeTypeLabel(type) {
  const map = { merchandise: '实物周边', photography: '摄影', other: '其他' }
  return map[type] || type || '-'
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
  loadPlatformHistory()
  loadPrintHistory()
})
</script>
