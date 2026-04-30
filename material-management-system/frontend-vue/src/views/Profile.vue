<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">个人信息</h1>
    </div>

    <div v-if="loading" class="loading-wrap">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <template v-else>
      <div class="profile-grid">
        <section class="card profile-section">
          <div class="section-header">
            <div class="section-title">基础信息</div>
          </div>
          <div class="profile-fields">
            <div>
              <div class="field-label">自定义 ID</div>
              <div class="field-value">{{ summary?.username || auth.user?.username || '-' }}</div>
            </div>
            <div>
              <div class="field-label">平台 UID</div>
              <div class="field-value">{{ summary?.uid || auth.user?.uid || '-' }}</div>
            </div>
            <div>
              <div class="field-label">主 QQ</div>
              <div class="field-value">{{ summary?.qq || auth.user?.qq || '-' }}</div>
            </div>
            <div>
              <div class="field-label">邮箱</div>
              <div class="field-value">{{ summary?.email || auth.user?.email || '-' }}</div>
            </div>
          </div>
        </section>

        <section class="card profile-section">
          <div class="section-header">
            <div class="section-title">新增身份</div>
          </div>
          <div class="identity-form">
            <select v-model="form.role" class="form-input" :class="{ error: errors.role }">
              <option value="">身份</option>
              <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
            </select>
            <select v-model="form.platform" class="form-input" :class="{ error: errors.platform }">
              <option value="">平台</option>
              <option v-for="platform in platformOptions" :key="platform" :value="platform">{{ platform }}</option>
            </select>
            <input
              v-model="form.nickname"
              class="form-input"
              :class="{ error: errors.nickname }"
              placeholder="圈名 ID"
              maxlength="50"
            />
            <input
              v-if="form.role === '文游作者'"
              v-model="form.uid"
              class="form-input"
              :class="{ error: errors.uid }"
              placeholder="文游作者 UID"
              maxlength="50"
            />
          </div>
          <div v-if="formError" class="form-error mt-2">{{ formError }}</div>
          <div class="form-actions-inline">
            <button class="btn btn-primary" :disabled="submitLoading" @click="openConfirm">
              {{ submitLoading ? '提交中...' : '提交审核' }}
            </button>
          </div>
        </section>
      </div>

      <section class="card profile-section mt-4">
        <div class="section-header">
          <div class="section-title">身份信息</div>
        </div>
        <div v-if="identities.length === 0" class="empty-state compact">
          <div class="empty-state-title">暂无身份</div>
        </div>
        <div v-else class="identity-list">
          <div v-for="identity in identities" :key="identity.id || identity._id || identity.nickname" class="identity-item">
            <div class="identity-main">
              <span class="identity-name">{{ identity.nickname || '-' }}</span>
              <span v-if="identity.is_primary" class="badge badge-primary">主身份</span>
              <span class="badge" :class="statusClass(identity.status)">{{ statusLabel(identity.status) }}</span>
            </div>
            <div class="identity-meta">
              <span>{{ identity.role || '-' }}</span>
              <span>{{ identity.platform || '-' }}</span>
              <span v-if="identity.uid">UID：{{ identity.uid }}</span>
            </div>
            <div v-if="identity.reject_reason" class="identity-reason">
              拒绝说明：{{ identity.reject_reason }}
            </div>
          </div>
        </div>
      </section>
    </template>

    <Teleport to="body">
      <div v-if="confirmModal" class="modal-overlay" @click.self="confirmModal = false">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">确认提交审核</span>
            <button class="modal-close" @click="confirmModal = false">&times;</button>
          </div>
          <div class="alert alert-warning">
            新身份提交后将进入管理员审核，审核期间该身份会显示为待审核状态。
          </div>
          <p class="text-sm text-muted">
            初次审核通常会在 24-48 小时内完成，需加急可联系群管理。非初次审核不可加急。
          </p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="confirmModal = false">取消</button>
            <button class="btn btn-primary" :disabled="submitLoading" @click="submitIdentity">
              {{ submitLoading ? '提交中...' : '确认提交' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useUserStore } from '@/stores/user.js'
import { meAPI } from '@/api/index.js'

const roleOptions = ['文游作者', '小说作者', '非重氪独立游戏作者', '美工']
const platformOptions = ['全平台', '橙光', '易次元', '闪艺', '晋江', '番茄', '微博', '小红书', '抖音', '快手']

const auth = useAuthStore()
const userStore = useUserStore()
const addToast = inject('addToast')

const form = reactive({ role: '', platform: '', nickname: '', uid: '' })
const errors = reactive({ role: '', platform: '', nickname: '', uid: '' })
const loading = ref(false)
const submitLoading = ref(false)
const confirmModal = ref(false)

const summary = computed(() => userStore.summary)
const identities = computed(() => summary.value?.identities || auth.user?.identities || [])
const formError = computed(() => errors.role || errors.platform || errors.nickname || errors.uid)

function clearErrors() {
  errors.role = ''
  errors.platform = ''
  errors.nickname = ''
  errors.uid = ''
}

function validateIdentity() {
  clearErrors()
  let valid = true
  const nickname = form.nickname.trim()
  if (!form.role) {
    errors.role = '请选择职业'
    valid = false
  }
  if (!form.platform) {
    errors.platform = '请选择平台'
    valid = false
  }
  if (!nickname) {
    errors.nickname = '请输入圈名 ID'
    valid = false
  } else if (/[<>\r\n\t]/.test(nickname)) {
    errors.nickname = '圈名 ID 不能包含换行或尖括号'
    valid = false
  }
  if (form.role === '文游作者' && !form.uid.trim()) {
    errors.uid = '请填写文游作者 UID'
    valid = false
  } else if (/[<>\r\n\t]/.test(form.uid)) {
    errors.uid = 'UID 不能包含换行或尖括号'
    valid = false
  }
  return valid
}

function openConfirm() {
  if (!validateIdentity()) return
  confirmModal.value = true
}

function resetForm() {
  form.role = ''
  form.platform = ''
  form.nickname = ''
  form.uid = ''
  clearErrors()
}

async function submitIdentity() {
  if (!validateIdentity()) return
  submitLoading.value = true
  try {
    const res = await meAPI.addIdentity({
      role: form.role,
      platform: form.platform,
      nickname: form.nickname.trim(),
      uid: form.role === '文游作者' ? form.uid.trim() : ''
    })
    if (userStore.summary) {
      userStore.summary = { ...userStore.summary, identities: res.identities || [] }
    }
    auth.updateUser({ identities: res.identities || [] })
    addToast(res.message || '新身份已提交审核', 'success')
    resetForm()
    confirmModal.value = false
  } catch (e) {
    addToast(e?.message || '提交失败，请稍后重试', 'error')
  } finally {
    submitLoading.value = false
  }
}

function statusLabel(status) {
  const map = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
  return map[status || 'approved'] || status
}

function statusClass(status) {
  const map = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' }
  return map[status || 'approved'] || 'badge-default'
}

onMounted(async () => {
  loading.value = true
  try {
    await userStore.fetchSummary()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  gap: 18px;
}

.profile-section {
  padding: 20px;
}

.profile-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field-label {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.field-value {
  font-weight: 600;
  color: var(--text);
  word-break: break-all;
}

.identity-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.identity-form input {
  grid-column: 1 / -1;
}

.form-actions-inline {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.identity-list {
  display: grid;
  gap: 10px;
}

.identity-item {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  background: #fff;
}

.identity-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.identity-name {
  font-weight: 700;
  color: var(--text);
}

.identity-meta {
  display: flex;
  gap: 10px;
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-top: 6px;
}

.identity-reason {
  margin-top: 8px;
  color: var(--danger);
  font-size: 0.85rem;
}

.compact {
  padding: 24px;
}

@media (max-width: 768px) {
  .profile-grid,
  .profile-fields,
  .identity-form {
    grid-template-columns: 1fr;
  }
}
</style>
