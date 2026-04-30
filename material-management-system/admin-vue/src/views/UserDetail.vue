<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">顾客详情</h1>
        <p class="page-subtitle">查看顾客完整信息与素材持有情况</p>
      </div>
      <router-link to="/users" class="btn btn-secondary">&larr; 返回列表</router-link>
    </div>

    <div v-if="loading" style="padding:48px;text-align:center;color:var(--text-muted,#9ca3af);">加载中...</div>

    <template v-else-if="user">
      <!-- User Info Card -->
      <div class="table-container" style="margin-bottom:20px;">
        <div class="table-toolbar">
          <span class="table-title">基本信息</span>
        </div>
        <div style="padding:20px;">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">平台 UID</span>
              <span class="info-value">{{ user.uid || '未生成' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">自定义 ID</span>
              <span class="info-value">{{ user.username }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">注册状态</span>
              <span class="info-value">
                <span class="status-badge" :class="registrationStatusClass(user.registration_status)">
                  {{ registrationStatusLabel(user.registration_status) }}
                </span>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">QQ</span>
              <span class="info-value">{{ user.qq || '未填写' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">邮箱</span>
              <span class="info-value">
                {{ user.email || '未绑定' }}
                <span v-if="user.email" :class="user.email_verified_at ? 'badge badge-success' : 'badge badge-default'" style="margin-left:6px;font-size:0.7rem;">
                  {{ user.email_verified_at ? '已验证' : '未验证' }}
                </span>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">平台</span>
              <span class="info-value">{{ user.platform || '未设置' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">平台 ID</span>
              <span class="info-value">{{ user.platform_id || '未设置' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">VIP 等级</span>
              <span class="info-value">
                <span v-if="user.vip_level" class="vip-badge" :class="`vip${user.vip_level}`">VIP{{ user.vip_level }}</span>
                <span v-else class="text-muted">无</span>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">累计积分</span>
              <span class="info-value">{{ user.points_total || 0 }} pts</span>
            </div>
            <div class="info-item">
              <span class="info-label">年度消费</span>
              <span class="info-value">{{ user.annual_spend || 0 }} pts</span>
            </div>
            <div class="info-item">
              <span class="info-label">转让剩余</span>
              <span class="info-value">{{ user.transfer_remaining || 0 }} 次</span>
            </div>
            <div class="info-item">
              <span class="info-label">回购剩余</span>
              <span class="info-value">{{ user.buyback_remaining || 0 }} 次</span>
            </div>
            <div class="info-item">
              <span class="info-label">帮回购剩余</span>
              <span class="info-value">{{ user.assisted_buyback_remaining || 0 }} 次</span>
            </div>
            <div class="info-item">
              <span class="info-label">注册时间</span>
              <span class="info-value">{{ formatDate(user.created_at) }}</span>
            </div>
            <div v-if="user.registration_reviewed_at" class="info-item">
              <span class="info-label">审核时间</span>
              <span class="info-value">{{ formatDate(user.registration_reviewed_at) }}</span>
            </div>
            <div v-if="user.registration_reject_reason" class="info-item">
              <span class="info-label">拒绝说明</span>
              <span class="info-value">{{ user.registration_reject_reason }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="table-container" style="margin-bottom:20px;">
        <div class="table-toolbar">
          <span class="table-title">身份信息（{{ (user.identities || []).length }} 个）</span>
        </div>
        <div v-if="!(user.identities || []).length" class="table-empty">暂无身份信息</div>
        <table v-else>
          <thead>
            <tr>
              <th>类型</th>
              <th>职业</th>
              <th>平台</th>
              <th>圈名 ID</th>
              <th>UID</th>
              <th>状态</th>
              <th>提交时间</th>
              <th>审核时间</th>
              <th>拒绝说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="identity in user.identities" :key="identity.id || identity._id || identity.nickname">
              <td>
                <span v-if="identity.is_primary" class="badge badge-info">主身份</span>
                <span v-else class="badge badge-default">副身份</span>
              </td>
              <td>{{ identity.role || '-' }}</td>
              <td>{{ identity.platform || '-' }}</td>
              <td>{{ identity.nickname || '-' }}</td>
              <td>{{ identity.uid || '-' }}</td>
              <td>
                <span class="status-badge" :class="registrationStatusClass(identity.status)">
                  {{ registrationStatusLabel(identity.status) }}
                </span>
              </td>
              <td class="text-sm text-muted">{{ formatDate(identity.submitted_at) }}</td>
              <td class="text-sm text-muted">{{ formatDate(identity.reviewed_at) }}</td>
              <td class="text-sm text-muted">{{ identity.reject_reason || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Ownerships Table -->
      <div class="table-container">
        <div class="table-toolbar">
          <span class="table-title">素材持有（{{ ownerships.length }} 件）</span>
        </div>

        <div v-if="ownerships.length === 0" class="table-empty">该用户暂无素材</div>
        <table v-else>
          <thead>
            <tr>
              <th>SKU</th>
              <th>素材名称</th>
              <th>画师</th>
              <th>获取类型</th>
              <th>积分</th>
              <th>关联用户</th>
              <th>获取时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in ownerships" :key="o._id">
              <td class="text-sm text-muted">{{ o.item_id?.sku_code || '-' }}</td>
              <td style="font-weight:500;">{{ o.item_id?.name || '(已删除)' }}</td>
              <td class="text-muted">{{ o.item_id?.artist || '-' }}</td>
              <td>
                <span :class="['badge', typeBadgeClass(o.acquisition_type)]">{{ typeLabel(o.acquisition_type) }}</span>
              </td>
              <td>{{ o.points_delta || 0 }}</td>
              <td class="text-sm">
                <span v-if="o.source_user_id && o.acquisition_type !== 'self'">
                  来自：{{ o.source_user_id.username }}
                  <span v-if="o.source_user_id.qq" class="text-muted">({{ o.source_user_id.qq }})</span>
                </span>
                <span v-if="o.target_user_id">
                  目标：{{ o.target_user_id.username }}
                  <span v-if="o.target_user_id.qq" class="text-muted">({{ o.target_user_id.qq }})</span>
                </span>
                <span v-if="!o.source_user_id && !o.target_user_id" class="text-muted">-</span>
              </td>
              <td class="text-sm text-muted">{{ formatDate(o.occurred_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-else class="table-container">
      <div class="table-empty">用户不存在</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usersAPI } from '../api/index.js'

const route = useRoute()
const loading = ref(true)
const user = ref(null)
const ownerships = ref([])

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function registrationStatusLabel(status) {
  const map = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
  return map[status || 'approved'] || status
}

function registrationStatusClass(status) {
  const map = { pending: 'pending', approved: 'approved', rejected: 'rejected' }
  return map[status || 'approved'] || 'approved'
}

function typeLabel(t) {
  const map = { self: '自用', sponsor: '已赞助', sponsored: '被赞助', sponsor_pending: '赞助待定', transfer_in: '自用', transfer_out: '转出记录' }
  return map[t] || t
}

function typeBadgeClass(t) {
  const map = { self: 'badge-success', sponsor: 'badge-info', sponsored: 'badge-warning', sponsor_pending: 'badge-default' }
  return map[t] || 'badge-default'
}

async function loadDetail() {
  loading.value = true
  try {
    const res = await usersAPI.getById(route.params.id)
    user.value = res.user || null
    ownerships.value = res.ownerships || []
  } catch {
    user.value = null
  } finally {
    loading.value = false
  }
}

onMounted(loadDetail)
</script>

<style scoped>
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.info-value {
  font-size: 0.9rem;
  color: var(--text-primary, #111827);
  font-weight: 500;
}
.badge-info {
  background: #dbeafe;
  color: #1d4ed8;
}
</style>
