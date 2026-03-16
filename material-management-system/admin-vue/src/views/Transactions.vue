<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">交易记录</h1>
        <p class="page-subtitle">查询所有素材交易流水</p>
      </div>
      <router-link to="/transactions/import" class="btn btn-primary">批量导入</router-link>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <div class="search-group">
        <label class="search-label">用户名/QQ</label>
        <input v-model="search.user" class="search-input" placeholder="用户名或QQ号..." @keyup.enter="doSearch" />
      </div>
      <div class="search-group">
        <label class="search-label">交易类型</label>
        <select v-model="search.type" class="search-input">
          <option value="">全部</option>
          <option value="purchase_self">自购</option>
          <option value="purchase_sponsor">赞助他人</option>
          <option value="sponsored">被赞助</option>
          <option value="transfer_out">转出</option>
          <option value="transfer_in">转入</option>
        </select>
      </div>
      <div class="search-group">
        <label class="search-label">开始日期</label>
        <input v-model="search.date_from" type="date" class="search-input" />
      </div>
      <div class="search-group">
        <label class="search-label">结束日期</label>
        <input v-model="search.date_to" type="date" class="search-input" />
      </div>
      <button class="btn btn-primary" @click="doSearch">搜索</button>
      <button class="btn btn-secondary" @click="resetSearch">重置</button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div class="table-toolbar">
        <span class="table-title">共 {{ total }} 条记录</span>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--border,#e5e7eb);">
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">时间</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">类型</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">操作人</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">目标用户</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">素材</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">价格</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">积分变化</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">有无链接</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="table-loading">加载中...</td>
          </tr>
          <tr v-else-if="rows.length === 0">
            <td colspan="8" class="table-empty">暂无交易记录</td>
          </tr>
          <template v-else>
            <tr v-for="row in rows" :key="row._id" class="table-row-hover">
              <td style="padding:10px 16px;font-size:13px;white-space:nowrap;color:var(--text-secondary,#6b7280);">
                {{ formatDate(row.occurred_at) }}
              </td>
              <td style="padding:10px 16px;">
                <span :class="['type-badge', typeBadgeClass(row.type)]">{{ typeLabel(row.type) }}</span>
              </td>
              <td style="padding:10px 16px;">
                <div style="font-size:13px;line-height:1.5;">
                  <div v-if="row.actor_id?.username" style="font-weight:500;">{{ row.actor_id.username }}</div>
                  <div v-if="row.actor_id?.qq" style="color:var(--text-muted,#9ca3af);">QQ: {{ row.actor_id.qq }}</div>
                  <span v-if="!row.actor_id?.username && !row.actor_id?.qq" style="color:var(--text-muted,#9ca3af);">—</span>
                </div>
              </td>
              <td style="padding:10px 16px;">
                <div style="font-size:13px;line-height:1.5;">
                  <div v-if="row.target_id?.username" style="font-weight:500;">{{ row.target_id.username }}</div>
                  <div v-if="row.target_id?.qq" style="color:var(--text-muted,#9ca3af);">QQ: {{ row.target_id.qq }}</div>
                  <span v-if="!row.target_id?.username && !row.target_id?.qq" style="color:var(--text-muted,#9ca3af);">—</span>
                </div>
              </td>
              <td style="padding:10px 16px;font-size:13px;">{{ row.item_id?.name || '—' }}</td>
              <td style="padding:10px 16px;font-size:13px;">{{ row.price != null ? row.price + ' pts' : '—' }}</td>
              <td style="padding:10px 16px;">
                <span
                  v-if="row.points_change != null"
                  :style="{ fontWeight: '500', color: row.points_change >= 0 ? '#059669' : '#dc2626' }"
                >
                  {{ row.points_change >= 0 ? '+' : '' }}{{ row.points_change }}
                </span>
                <span v-else style="color:var(--text-muted,#9ca3af);">—</span>
              </td>
              <td style="padding:10px 16px;">
                <span v-if="row.has_delivery_link" class="badge" style="background:#d1fae5;color:#065f46;font-size:12px;">有链接</span>
                <span v-else style="color:var(--text-muted,#9ca3af);font-size:13px;">无</span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="total > pageSize" class="pagination">
        <span class="pagination-info">第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条</span>
        <div class="pagination-controls">
          <button class="page-btn" :disabled="page <= 1" @click="changePage(page - 1)">«</button>
          <button
            v-for="p in visiblePages"
            :key="p"
            :class="['page-btn', { active: p === page }]"
            @click="changePage(p)"
          >{{ p }}</button>
          <button class="page-btn" :disabled="page >= totalPages" @click="changePage(page + 1)">»</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { transactionsAPI } from '@/api/index.js'

// ── State ─────────────────────────────────────────────────────────────────────
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = 20

const search = ref({ user: '', type: '', date_from: '', date_to: '' })

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, page.value - 2)
  const end = Math.min(totalPages.value, start + 4)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

// ── API ───────────────────────────────────────────────────────────────────────
async function fetchData() {
  loading.value = true
  try {
    const params = { page: page.value, limit: pageSize }
    if (search.value.user) params.user = search.value.user
    if (search.value.type) params.type = search.value.type
    if (search.value.date_from) params.date_from = search.value.date_from
    if (search.value.date_to) params.date_to = search.value.date_to
    const res = await transactionsAPI.getAll(params)
    rows.value = res.transactions || []
    total.value = res.total || 0
  } finally {
    loading.value = false
  }
}

function doSearch() { page.value = 1; fetchData() }
function resetSearch() { search.value = { user: '', type: '', date_from: '', date_to: '' }; page.value = 1; fetchData() }
function changePage(p) { if (p < 1 || p > totalPages.value) return; page.value = p; fetchData() }

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function typeLabel(t) {
  const map = {
    purchase_self: '自购',
    purchase_sponsor: '赞助他人',
    sponsored: '被赞助',
    transfer_out: '转出',
    transfer_in: '转入'
  }
  return map[t] || t
}

function typeBadgeClass(t) {
  const map = {
    purchase_self: 'self',
    purchase_sponsor: 'sponsor',
    sponsored: 'sponsored',
    transfer_out: 'transfer-out',
    transfer_in: 'transfer-in'
  }
  return map[t] || t
}

onMounted(fetchData)
</script>
