<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">VIP 顾客</h1>
        <p class="page-subtitle">查看并管理所有 VIP 顾客信息</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" @click="showResetModal = true">重置年度次数</button>
        <button class="btn btn-warning" @click="showAnnualModal = true">重置年度消费</button>
      </div>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <div class="search-group">
        <label class="search-label">用户名/QQ</label>
        <input v-model="search.q" class="search-input" placeholder="用户名或QQ号..." @keyup.enter="doSearch" />
      </div>
      <div class="search-group">
        <label class="search-label">VIP等级</label>
        <select v-model="search.vip_level" class="search-input">
          <option value="">全部</option>
          <option value="1">VIP1</option>
          <option value="2">VIP2</option>
          <option value="3">VIP3</option>
          <option value="4">VIP4</option>
          <option value="5">VIP5</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="doSearch">搜索</button>
      <button class="btn btn-secondary" @click="resetSearch">重置</button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div class="table-toolbar">
        <span class="table-title">共 {{ total }} 位 VIP 顾客</span>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--border,#e5e7eb);">
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">用户名</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">QQ</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">平台</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">VIP等级</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">累计积分</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">年度消费</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">剩余转让</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">剩余回购</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="9" class="table-loading">加载中...</td>
          </tr>
          <tr v-else-if="rows.length === 0">
            <td colspan="9" class="table-empty">暂无 VIP 顾客数据</td>
          </tr>
          <template v-else>
            <tr v-for="row in rows" :key="row._id" class="table-row-hover">
              <td style="padding:10px 16px;font-weight:500;">{{ row.username || '—' }}</td>
              <td style="padding:10px 16px;color:var(--text-secondary,#6b7280);">{{ row.qq || '—' }}</td>
              <td style="padding:10px 16px;font-size:13px;">{{ row.platform || '—' }}</td>
              <td style="padding:10px 16px;">
                <span :class="['vip-badge', row.vip_level ? `vip${row.vip_level}` : 'none']">
                  {{ row.vip_level ? `VIP${row.vip_level}` : '无' }}
                </span>
              </td>
              <td style="padding:10px 16px;">{{ row.points_total ?? '—' }}</td>
              <td style="padding:10px 16px;">{{ row.annual_spend != null ? row.annual_spend + ' pts' : '—' }}</td>
              <td style="padding:10px 16px;">{{ row.transfer_remaining ?? '—' }}</td>
              <td style="padding:10px 16px;">{{ row.buyback_remaining ?? '—' }}</td>
              <td style="padding:10px 16px;">
                <button class="btn btn-sm btn-secondary" @click="openEdit(row)">编辑</button>
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

    <!-- Edit Modal -->
    <div v-if="editModal.show" class="modal-overlay" @click.self="editModal.show = false">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">编辑 VIP 顾客 — {{ editModal.row?.username }}</span>
          <button class="modal-close" @click="editModal.show = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">VIP 等级</label>
              <select v-model.number="editModal.form.vip_level" class="form-select">
                <option :value="0">无 VIP</option>
                <option :value="1">VIP1</option>
                <option :value="2">VIP2</option>
                <option :value="3">VIP3</option>
                <option :value="4">VIP4</option>
                <option :value="5">VIP5</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">累计积分</label>
              <input v-model.number="editModal.form.points_total" type="number" min="0" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">剩余转让次数</label>
              <input v-model.number="editModal.form.transfer_remaining" type="number" min="0" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">剩余回购次数</label>
              <input v-model.number="editModal.form.buyback_remaining" type="number" min="0" class="form-input" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="editModal.show = false">取消</button>
          <button class="btn btn-primary" :disabled="editModal.loading" @click="submitEdit">
            {{ editModal.loading ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Reset Counters Modal -->
    <div v-if="showResetModal" class="modal-overlay" @click.self="showResetModal = false">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">重置年度次数</span>
          <button class="modal-close" @click="showResetModal = false">✕</button>
        </div>
        <div class="modal-body">
          <p class="info-text" style="margin-bottom:12px;">此操作将重置所有 VIP 顾客的剩余转让次数和回购次数至等级默认值，通常在每年年初执行。</p>
          <p class="confirm-text">确认要重置所有顾客的年度次数吗？</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showResetModal = false">取消</button>
          <button class="btn btn-primary" :disabled="resetLoading" @click="handleResetCounters">
            {{ resetLoading ? '处理中...' : '确认重置' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Reset Annual Spend Modal -->
    <div v-if="showAnnualModal" class="modal-overlay" @click.self="showAnnualModal = false">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">重置年度消费</span>
          <button class="modal-close" @click="showAnnualModal = false">✕</button>
        </div>
        <div class="modal-body">
          <p class="warning-text" style="margin-bottom:12px;">此操作将重新计算所有用户VIP等级，并清零年度消费数据，执行后无法撤销！</p>
          <p class="confirm-text">通常在每年年初执行。确认要重置年度消费并重新计算 VIP 等级吗？</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAnnualModal = false">取消</button>
          <button class="btn btn-danger" :disabled="annualLoading" @click="handleResetAnnual">
            {{ annualLoading ? '处理中...' : '确认重置（不可撤销）' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { vipsAPI } from '@/api/index.js'

const _addToast = inject('addToast')
function addToast(message, type = 'success') { _addToast(type, message) }

// ── State ─────────────────────────────────────────────────────────────────────
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const search = ref({ q: '', vip_level: '' })

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
    if (search.value.q) params.q = search.value.q
    if (search.value.vip_level) params.vip_level = search.value.vip_level
    const res = await vipsAPI.getCustomers(params)
    rows.value = res.users || []
    total.value = res.total || 0
  } catch {
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function doSearch() { page.value = 1; fetchData() }
function resetSearch() { search.value = { q: '', vip_level: '' }; page.value = 1; fetchData() }
function changePage(p) { if (p < 1 || p > totalPages.value) return; page.value = p; fetchData() }

// ── Edit Modal ────────────────────────────────────────────────────────────────
const editModal = ref({ show: false, row: null, loading: false, form: { vip_level: 0, points_total: 0, transfer_remaining: 0, buyback_remaining: 0 } })

function openEdit(row) {
  editModal.value = {
    show: true,
    row,
    loading: false,
    form: {
      vip_level: row.vip_level ?? 0,
      points_total: row.points_total ?? 0,
      transfer_remaining: row.transfer_remaining ?? 0,
      buyback_remaining: row.buyback_remaining ?? 0
    }
  }
}

async function submitEdit() {
  editModal.value.loading = true
  try {
    await vipsAPI.updateCustomer(editModal.value.row._id, editModal.value.form)
    addToast('VIP 顾客信息已更新', 'success')
    editModal.value.show = false
    fetchData()
  } catch (e) {
    addToast(e?.message || '保存失败', 'error')
  } finally {
    editModal.value.loading = false
  }
}

// ── Reset Counters ────────────────────────────────────────────────────────────
const showResetModal = ref(false)
const resetLoading = ref(false)

async function handleResetCounters() {
  resetLoading.value = true
  try {
    await vipsAPI.resetCounters({})
    addToast('年度次数已重置', 'success')
    showResetModal.value = false
    fetchData()
  } catch (e) {
    addToast(e?.message || '重置失败', 'error')
  } finally {
    resetLoading.value = false
  }
}

// ── Reset Annual Spend ────────────────────────────────────────────────────────
const showAnnualModal = ref(false)
const annualLoading = ref(false)

async function handleResetAnnual() {
  annualLoading.value = true
  try {
    await vipsAPI.resetAnnualSpend()
    addToast('年度消费已重置，VIP 等级已重新计算', 'success')
    showAnnualModal.value = false
    fetchData()
  } catch (e) {
    addToast(e?.message || '重置失败', 'error')
  } finally {
    annualLoading.value = false
  }
}

onMounted(fetchData)
</script>
