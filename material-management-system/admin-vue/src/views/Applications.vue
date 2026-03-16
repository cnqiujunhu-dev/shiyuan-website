<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">审核中心</div>
        <div class="page-subtitle">处理平台更换申请与自印报备</div>
      </div>
    </div>

    <div class="page">
      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'platform' }" @click="switchTab('platform')">
          平台更换申请
          <span v-if="pendingCount.platform > 0" style="margin-left:6px;background:#ef4444;color:#fff;border-radius:99px;padding:1px 6px;font-size:11px">{{ pendingCount.platform }}</span>
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'print' }" @click="switchTab('print')">
          自印报备
          <span v-if="pendingCount.print > 0" style="margin-left:6px;background:#ef4444;color:#fff;border-radius:99px;padding:1px 6px;font-size:11px">{{ pendingCount.print }}</span>
        </button>
      </div>

      <!-- Status Filter -->
      <div class="search-bar" style="border-radius:0 0 var(--radius) var(--radius);margin-top:-1px;border-top:none">
        <div class="search-group">
          <label class="search-label">状态筛选</label>
          <select v-model="filters.status" class="search-input" @change="search">
            <option value="">全部</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>
        <button class="btn btn-secondary btn-sm" @click="resetFilters">重置</button>
      </div>

      <!-- Table: Platform Change -->
      <div v-if="activeTab === 'platform'" class="table-container table-row-hover">
        <div class="table-toolbar">
          <span class="table-title">平台更换申请 - 共 {{ total }} 条</span>
        </div>

        <div v-if="loading" class="table-loading">加载中...</div>
        <div v-else-if="rows.length === 0" class="table-empty">暂无申请记录</div>
        <table v-else>
          <thead>
            <tr>
              <th>申请时间</th>
              <th>用户名</th>
              <th>当前平台</th>
              <th>申请改为</th>
              <th>备注</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="text-sm text-muted">{{ formatDate(row.created_at) }}</td>
              <td style="font-weight:500">{{ row.username || row.user?.username || '-' }}</td>
              <td>
                <span class="text-sm">{{ row.current_platform || '-' }}</span>
                <span v-if="row.current_platform_id" class="text-muted text-sm"> / {{ row.current_platform_id }}</span>
              </td>
              <td>
                <span class="text-sm" style="color:var(--primary);font-weight:500">{{ row.new_platform || '-' }}</span>
                <span v-if="row.new_platform_id" class="text-muted text-sm"> / {{ row.new_platform_id }}</span>
              </td>
              <td class="text-sm text-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {{ row.note || '-' }}
              </td>
              <td>
                <span class="status-badge" :class="row.status">{{ statusLabel(row.status) }}</span>
              </td>
              <td>
                <button
                  v-if="row.status === 'pending'"
                  class="btn btn-primary btn-sm"
                  @click="openDecide(row)"
                >
                  审批
                </button>
                <button
                  v-else
                  class="btn btn-ghost btn-sm"
                  @click="openDecide(row)"
                >
                  查看
                </button>
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

      <!-- Table: Print Report -->
      <div v-if="activeTab === 'print'" class="table-container table-row-hover">
        <div class="table-toolbar">
          <span class="table-title">自印报备 - 共 {{ total }} 条</span>
        </div>

        <div v-if="loading" class="table-loading">加载中...</div>
        <div v-else-if="rows.length === 0" class="table-empty">暂无报备记录</div>
        <table v-else>
          <thead>
            <tr>
              <th>申请时间</th>
              <th>用户名</th>
              <th>素材名称</th>
              <th>二创类型</th>
              <th>创作者信息</th>
              <th>份数</th>
              <th>用途</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="text-sm text-muted">{{ formatDate(row.created_at) }}</td>
              <td style="font-weight:500">{{ row.username || row.user?.username || '-' }}</td>
              <td>{{ row.item_name || row.item?.name || '-' }}</td>
              <td>{{ row.creation_type || '-' }}</td>
              <td class="text-sm">
                <div v-if="row.creator_name">{{ row.creator_name }}</div>
                <div v-if="row.creator_contact" class="text-muted">{{ row.creator_contact }}</div>
              </td>
              <td>{{ row.quantity != null ? `${row.quantity} 份` : '-' }}</td>
              <td class="text-sm text-muted" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {{ row.usage || '-' }}
              </td>
              <td>
                <span class="status-badge" :class="row.status">{{ statusLabel(row.status) }}</span>
              </td>
              <td>
                <button
                  v-if="row.status === 'pending'"
                  class="btn btn-primary btn-sm"
                  @click="openDecide(row)"
                >
                  审批
                </button>
                <button v-else class="btn btn-ghost btn-sm" @click="openDecide(row)">查看</button>
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

    <!-- Decide Modal -->
    <div v-if="decideModal.show" class="modal-overlay" @click.self="decideModal.show = false">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">{{ decideModal.row?.status === 'pending' ? '审批申请' : '申请详情' }}</span>
          <button class="modal-close" @click="decideModal.show = false">✕</button>
        </div>
        <div class="modal-body">
          <!-- Application details -->
          <div class="import-desc mb-3">
            <div class="import-desc-title">申请信息</div>
            <template v-if="activeTab === 'platform'">
              <p>用户：{{ decideModal.row?.username }}</p>
              <p>当前：{{ decideModal.row?.current_platform }} / {{ decideModal.row?.current_platform_id }}</p>
              <p>申请改为：{{ decideModal.row?.new_platform }} / {{ decideModal.row?.new_platform_id }}</p>
              <p v-if="decideModal.row?.note">备注：{{ decideModal.row?.note }}</p>
            </template>
            <template v-else>
              <p>用户：{{ decideModal.row?.username }}</p>
              <p>素材：{{ decideModal.row?.item_name }}</p>
              <p>二创类型：{{ decideModal.row?.creation_type }}</p>
              <p v-if="decideModal.row?.quantity">份数：{{ decideModal.row?.quantity }} 份</p>
              <p v-if="decideModal.row?.usage">用途：{{ decideModal.row?.usage }}</p>
            </template>
          </div>

          <div v-if="decideModal.row?.status === 'pending'">
            <div class="form-group mb-3">
              <label class="form-label">审批结果 <span class="required">*</span></label>
              <select v-model="decideModal.decision" class="form-select">
                <option value="approved">通过</option>
                <option value="rejected">拒绝</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">备注（可选）</label>
              <textarea v-model="decideModal.remark" class="form-textarea" rows="3" placeholder="审批备注，将通知给用户..." />
            </div>
          </div>
          <div v-else>
            <div class="form-group">
              <label class="form-label">审批结果</label>
              <div>
                <span class="status-badge" :class="decideModal.row?.status">{{ statusLabel(decideModal.row?.status) }}</span>
              </div>
            </div>
            <div v-if="decideModal.row?.admin_remark" class="form-group mt-3">
              <label class="form-label">审批备注</label>
              <div class="text-sm text-muted">{{ decideModal.row?.admin_remark }}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="decideModal.show = false">
            {{ decideModal.row?.status === 'pending' ? '取消' : '关闭' }}
          </button>
          <button
            v-if="decideModal.row?.status === 'pending'"
            class="btn btn-primary"
            :disabled="decideModal.loading"
            @click="submitDecide"
          >
            {{ decideModal.loading ? '提交中...' : '提交审批' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { applicationsAPI } from '../api/index.js'

const addToast = inject('addToast')

const activeTab = ref('platform')
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const pendingCount = ref({ platform: 0, print: 0 })

const filters = ref({ status: '' })

const totalPages = computed(() => Math.ceil(total.value / pageSize))
const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, page.value - 2)
  const end = Math.min(totalPages.value, page.value + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

function tabType() {
  return activeTab.value === 'platform' ? 'platform_change' : 'print_report'
}

async function loadData() {
  loading.value = true
  try {
    const params = { page: page.value, limit: pageSize, type: tabType() }
    if (filters.value.status) params.status = filters.value.status
    const res = await applicationsAPI.getAll(params)
    rows.value = res.applications || res.data || []
    total.value = res.total || rows.value.length

    // Count pending
    if (!filters.value.status) {
      const pending = rows.value.filter(r => r.status === 'pending').length
      if (activeTab.value === 'platform') pendingCount.value.platform = pending
      else pendingCount.value.print = pending
    }
  } finally {
    loading.value = false
  }
}

function switchTab(tab) {
  activeTab.value = tab
  page.value = 1
  filters.value.status = ''
  loadData()
}

function search() { page.value = 1; loadData() }
function resetFilters() { filters.value = { status: '' }; page.value = 1; loadData() }
function changePage(p) { page.value = p; loadData() }

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-CN')
}

function statusLabel(s) {
  const map = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
  return map[s] || s
}

// Decide Modal
const decideModal = ref({
  show: false, row: null, loading: false,
  decision: 'approved', remark: ''
})

function openDecide(row) {
  decideModal.value = {
    show: true, row,
    loading: false, decision: 'approved', remark: ''
  }
}

async function submitDecide() {
  decideModal.value.loading = true
  try {
    await applicationsAPI.decide(decideModal.value.row.id, {
      status: decideModal.value.decision,
      admin_remark: decideModal.value.remark
    })
    addToast('success', '审批成功', `申请已${decideModal.value.decision === 'approved' ? '通过' : '拒绝'}`)
    decideModal.value.show = false
    loadData()
  } catch (e) {
    addToast('error', '审批失败', e.message)
  } finally {
    decideModal.value.loading = false
  }
}

onMounted(loadData)
</script>
