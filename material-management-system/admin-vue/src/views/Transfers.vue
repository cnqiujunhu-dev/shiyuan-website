<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">转让记录</div>
        <div class="page-subtitle">查询所有素材转让记录，支持回滚操作</div>
      </div>
    </div>

    <div class="page">
      <!-- Search Bar -->
      <div class="search-bar">
        <div class="search-group">
          <label class="search-label">开始日期</label>
          <input v-model="filters.start_date" type="date" class="search-input" />
        </div>
        <div class="search-group">
          <label class="search-label">结束日期</label>
          <input v-model="filters.end_date" type="date" class="search-input" />
        </div>
        <div class="search-group">
          <label class="search-label">用户（QQ/ID）</label>
          <input v-model="filters.user" class="search-input" placeholder="QQ号 或 平台ID" />
        </div>
        <button class="btn btn-primary btn-sm" @click="search">搜索</button>
        <button class="btn btn-secondary btn-sm" @click="resetFilters">重置</button>
      </div>

      <!-- Table -->
      <div class="table-container table-row-hover">
        <div class="table-toolbar">
          <span class="table-title">共 {{ total }} 条转让记录</span>
        </div>

        <div v-if="loading" class="table-loading">加载中...</div>
        <div v-else-if="rows.length === 0" class="table-empty">暂无转让记录</div>
        <table v-else>
          <thead>
            <tr>
              <th>转让时间</th>
              <th>素材名称</th>
              <th>转让方</th>
              <th>接转方</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="text-sm text-muted" style="white-space:nowrap">
                {{ formatDate(row.created_at) }}
              </td>
              <td style="font-weight:500">{{ row.item_name || row.item?.name || '-' }}</td>
              <td>
                <div class="text-sm">
                  <div v-if="row.from_platform">{{ row.from_platform }}</div>
                  <div style="font-weight:500">{{ row.from_id || '-' }}</div>
                  <div class="text-muted">QQ: {{ row.from_qq || '-' }}</div>
                  <span v-if="row.from_vip_level" class="vip-badge" :class="`vip${row.from_vip_level}`" style="margin-top:2px;display:inline-flex">
                    VIP{{ row.from_vip_level }}
                  </span>
                </div>
              </td>
              <td>
                <div class="text-sm">
                  <div v-if="row.to_platform">{{ row.to_platform }}</div>
                  <div style="font-weight:500">{{ row.to_id || '-' }}</div>
                  <div class="text-muted">QQ: {{ row.to_qq || '-' }}</div>
                </div>
              </td>
              <td>
                <span v-if="row.rolled_back" class="status-badge rejected">已回滚</span>
                <span v-else class="status-badge approved">有效</span>
              </td>
              <td>
                <button
                  v-if="!row.rolled_back"
                  class="btn btn-danger btn-sm"
                  @click="openRollback(row)"
                >
                  回滚
                </button>
                <span v-else class="text-muted text-sm">-</span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div v-if="total > pageSize" class="pagination">
          <span class="pagination-info">第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条</span>
          <div class="pagination-controls">
            <button class="page-btn" :disabled="page <= 1" @click="changePage(page - 1)">«</button>
            <template v-for="p in visiblePages" :key="p">
              <button class="page-btn" :class="{ active: p === page }" @click="changePage(p)">{{ p }}</button>
            </template>
            <button class="page-btn" :disabled="page >= totalPages" @click="changePage(page + 1)">»</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Rollback Confirm Modal -->
    <div v-if="rollbackModal.show" class="modal-overlay" @click.self="rollbackModal.show = false">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">确认回滚转让</span>
          <button class="modal-close" @click="rollbackModal.show = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="warning-text mb-3">
            ⚠️ 危险操作！回滚转让将产生以下影响，操作后不可撤销：
          </div>
          <ul style="font-size:13px;color:var(--text);line-height:1.8;padding-left:18px;margin-bottom:12px">
            <li>素材归属将从「{{ rollbackModal.row?.to_id }}」恢复给「{{ rollbackModal.row?.from_id }}」</li>
            <li>接转方（{{ rollbackModal.row?.to_id }}）的相关积分将被撤销</li>
            <li>转让方（{{ rollbackModal.row?.from_id }}）的剩余转让次数将恢复</li>
          </ul>
          <p class="confirm-text" style="font-size:13px">
            素材：<strong>{{ rollbackModal.row?.item_name }}</strong>
            <br />
            转让时间：{{ formatDate(rollbackModal.row?.created_at) }}
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="rollbackModal.show = false">取消</button>
          <button class="btn btn-danger" :disabled="rollbackModal.loading" @click="confirmRollback">
            {{ rollbackModal.loading ? '回滚中...' : '确认回滚此转让' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { transfersAPI } from '../api/index.js'

const addToast = inject('addToast')

const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)

const filters = ref({ start_date: '', end_date: '', user: '' })

const totalPages = computed(() => Math.ceil(total.value / pageSize))
const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, page.value - 2)
  const end = Math.min(totalPages.value, page.value + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

async function loadData() {
  loading.value = true
  try {
    const params = { page: page.value, limit: pageSize }
    if (filters.value.start_date) params.start_date = filters.value.start_date
    if (filters.value.end_date) params.end_date = filters.value.end_date
    if (filters.value.user) params.user = filters.value.user
    const res = await transfersAPI.getAll(params)
    rows.value = res.transfers || res.data || []
    total.value = res.total || rows.value.length
  } catch {
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function search() { page.value = 1; loadData() }
function resetFilters() { filters.value = { start_date: '', end_date: '', user: '' }; page.value = 1; loadData() }
function changePage(p) { page.value = p; loadData() }

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-CN')
}

// Rollback Modal
const rollbackModal = ref({ show: false, row: null, loading: false })

function openRollback(row) {
  rollbackModal.value = { show: true, row, loading: false }
}

async function confirmRollback() {
  rollbackModal.value.loading = true
  try {
    await transfersAPI.rollback(rollbackModal.value.row.id)
    addToast('success', '回滚成功', '转让已撤销，归属已恢复')
    rollbackModal.value.show = false
    loadData()
  } catch (e) {
    addToast('error', '回滚失败', e.message)
  } finally {
    rollbackModal.value.loading = false
  }
}

onMounted(loadData)
</script>
