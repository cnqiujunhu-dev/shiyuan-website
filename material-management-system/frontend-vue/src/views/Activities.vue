<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">交易记录</h1>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-nav">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab-item', { active: activeTab === tab.value }]"
        @click="switchTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <select
        v-model="filters.type"
        class="form-input"
        style="min-width:130px;"
        @change="activeTab = filters.type"
      >
        <option value="">全部类型</option>
        <option value="purchase_self">自购</option>
        <option value="purchase_sponsor">赞助他人</option>
        <option value="sponsored">被赞助</option>
        <option value="transfer_out">转出</option>
        <option value="transfer_in">转入</option>
      </select>
      <input
        v-model="filters.start_date"
        type="date"
        class="form-input"
        style="min-width:145px;"
      />
      <span class="text-muted text-sm" style="flex-shrink:0;">至</span>
      <input
        v-model="filters.end_date"
        type="date"
        class="form-input"
        style="min-width:145px;"
      />
      <button class="btn btn-primary btn-sm" @click="loadActivities(1)">搜索</button>
      <button class="btn btn-ghost btn-sm" @click="resetFilters">重置</button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" style="display:flex;flex-direction:column;gap:1px;">
      <div
        v-for="i in 5"
        :key="i"
        class="asset-item"
        style="padding:16px;gap:12px;align-items:center;"
      >
        <div
          class="skeleton"
          style="width:40px;height:40px;border-radius:50%;flex-shrink:0;"
        ></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
          <div class="skeleton skeleton-line" style="width:55%;height:15px;border-radius:4px;"></div>
          <div class="skeleton skeleton-line" style="width:35%;height:13px;border-radius:4px;"></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
          <div class="skeleton skeleton-line" style="width:72px;height:15px;border-radius:4px;"></div>
          <div class="skeleton skeleton-line" style="width:96px;height:12px;border-radius:4px;"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-else-if="!loading && activities.length === 0">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-title">暂无交易记录</div>
      <div class="empty-state-desc">没有符合条件的交易记录</div>
    </div>

    <!-- Activity List -->
    <div v-else style="display:flex;flex-direction:column;gap:1px;">
      <div
        v-for="activity in activities"
        :key="activity._id || activity.id"
        class="asset-item"
        style="padding:16px;gap:12px;align-items:center;"
      >
        <!-- Type Icon -->
        <div
          :style="{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            flexShrink: 0,
            background: getIconBg(activity.type),
          }"
        >
          {{ getTypeIcon(activity.type) }}
        </div>

        <!-- Content -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
            <span :class="['badge', getTypeBadgeClass(activity.type)]">
              {{ getTypeLabel(activity.type) }}
            </span>
            <span style="font-weight:500;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;">
              {{ activity.item_id?.name || '-' }}
            </span>
          </div>
          <div class="text-sm text-muted" v-if="activity.item_id?.artist">
            画师：{{ activity.item_id.artist }}
          </div>
        </div>

        <!-- Points & Date -->
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;text-align:right;">
          <div
            :style="{
              fontWeight: 600,
              fontSize: '0.95rem',
              color: getPointsColor(activity.type),
            }"
          >
            {{ formatPoints(activity) }}
          </div>
          <div class="text-sm text-muted">{{ formatDate(activity.occurred_at) }}</div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <Pagination :total="total" :page="page" :limit="limit" @change="loadActivities" />
  </div>
</template>

<script setup>
import { ref, reactive, inject, onMounted } from 'vue'
import { meAPI } from '@/api/index.js'
import Pagination from '@/components/Pagination.vue'

const addToast = inject('addToast')

const activities = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const activeTab = ref('')

const filters = reactive({
  type: '',
  start_date: '',
  end_date: '',
})

const tabs = [
  { value: '', label: '全部' },
  { value: 'purchase_self', label: '自购' },
  { value: 'purchase_sponsor', label: '赞助他人' },
  { value: 'sponsored', label: '被赞助' },
  { value: 'transfer_out', label: '转出' },
  { value: 'transfer_in', label: '转入' },
]

const typeConfig = {
  purchase_self:    { label: '自购',    icon: '🛒', badge: 'badge-primary', iconBg: '#ede9fe' },
  purchase_sponsor: { label: '赞助他人', icon: '🎁', badge: 'badge-warning', iconBg: '#fef3c7' },
  sponsored:        { label: '被赞助',  icon: '🎀', badge: 'badge-success', iconBg: '#dcfce7' },
  transfer_out:     { label: '转出',    icon: '📤', badge: 'badge-danger',  iconBg: '#fee2e2' },
  transfer_in:      { label: '转入',    icon: '📥', badge: 'badge-success', iconBg: '#dcfce7' },
}

function getTypeLabel(type) {
  return typeConfig[type]?.label || type
}

function getTypeIcon(type) {
  return typeConfig[type]?.icon || '📄'
}

function getTypeBadgeClass(type) {
  return typeConfig[type]?.badge || 'badge-default'
}

function getIconBg(type) {
  return typeConfig[type]?.iconBg || '#f3f4f6'
}

function getPointsColor(type) {
  if (type === 'purchase_self' || type === 'purchase_sponsor' || type === 'transfer_in') {
    return 'var(--success, #16a34a)'
  }
  return 'var(--text-muted, #6b7280)'
}

function formatPoints(activity) {
  const { type, points_change } = activity
  if (type === 'transfer_out') return '—'
  if (type === 'sponsored') return '0'
  if (points_change == null) return '—'
  if (points_change > 0) return `+${points_change.toLocaleString()}`
  return points_change.toLocaleString()
}

function formatDate(val) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadActivities(p = 1) {
  page.value = p
  loading.value = true
  try {
    const params = { page: p, limit: limit.value }
    if (filters.type) params.type = filters.type
    if (filters.start_date) params.from = filters.start_date
    if (filters.end_date) params.to = filters.end_date
    const res = await meAPI.getActivities(params)
    activities.value = res.activities || res.transactions || []
    total.value = res.total || 0
  } catch (e) {
    addToast('加载记录失败', 'error')
  } finally {
    loading.value = false
  }
}

function switchTab(value) {
  activeTab.value = value
  filters.type = value
  loadActivities(1)
}

function resetFilters() {
  filters.type = ''
  filters.start_date = ''
  filters.end_date = ''
  activeTab.value = ''
  loadActivities(1)
}

onMounted(() => {
  loadActivities(1)
})
</script>
