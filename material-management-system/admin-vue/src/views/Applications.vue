<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">审核中心</div>
        <div class="page-subtitle">处理注册、身份与素材回购申请</div>
      </div>
    </div>

    <div class="page">
      <div class="search-bar">
        <div class="search-group">
          <label class="search-label">申请类型</label>
          <select v-model="filters.type" class="search-input" @change="search">
            <option value="">全部</option>
            <option value="registration">注册审核</option>
            <option value="identity">身份审核</option>
            <option value="buyback">素材回购</option>
          </select>
        </div>
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

      <div class="table-container table-row-hover">
        <div class="table-toolbar">
          <span class="table-title">审核申请 - 共 {{ total }} 条</span>
        </div>
        <div v-if="loading" class="table-loading">加载中...</div>
        <div v-else-if="rows.length === 0" class="table-empty">暂无审核记录</div>
        <table v-else>
          <thead>
            <tr>
              <th>类型</th>
              <th>申请时间</th>
              <th>申请人</th>
              <th>申请内容</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row._id">
              <td><span class="badge badge-default">{{ typeLabel(row.type) }}</span></td>
              <td class="text-sm text-muted">{{ formatDate(row.created_at) }}</td>
              <td>
                <div style="font-weight:500">{{ applicantName(row) }}</div>
                <div class="text-sm text-muted">{{ applicantMeta(row) }}</div>
              </td>
              <td class="text-sm">
                <div>{{ applicationTitle(row) }}</div>
                <div v-if="applicationSubTitle(row)" class="text-muted" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  {{ applicationSubTitle(row) }}
                </div>
              </td>
              <td><span class="status-badge" :class="row.status">{{ statusLabel(row.status) }}</span></td>
              <td>
                <button v-if="row.status === 'pending'" class="btn btn-primary btn-sm" @click="openDecide(row)">审批</button>
                <button v-else class="btn btn-ghost btn-sm" @click="openDecide(row)">查看</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="total > pageSize" class="pagination">
          <span class="pagination-info">第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条</span>
          <div class="pagination-controls">
            <button class="page-btn" :disabled="page <= 1" @click="changePage(page - 1)">&laquo;</button>
            <template v-for="p in visiblePages" :key="p">
              <button class="page-btn" :class="{ active: p === page }" @click="changePage(p)">{{ p }}</button>
            </template>
            <button class="page-btn" :disabled="page >= totalPages" @click="changePage(page + 1)">&raquo;</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="decideModal.show" class="modal-overlay" @click.self="decideModal.show = false">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">{{ decideModal.row?.status === 'pending' ? '审批申请' : '申请详情' }}</span>
          <button class="modal-close" @click="decideModal.show = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="import-desc mb-3">
            <div class="import-desc-title">{{ typeLabel(decideModal.row?.type) }}</div>
            <template v-if="decideModal.row?.type === 'registration'">
              <p>自定义 ID：{{ decideModal.row?.user_id?.username || decideModal.row?.payload?.username || '-' }}</p>
              <p>平台 UID：{{ decideModal.row?.user_id?.uid || decideModal.row?.payload?.uid || '-' }}</p>
              <p>主 QQ：{{ decideModal.row?.user_id?.qq || decideModal.row?.payload?.qq || '-' }}</p>
              <p>QQ 邮箱：{{ decideModal.row?.user_id?.email || decideModal.row?.payload?.email || '-' }}</p>
              <p>登记身份：</p>
              <ul v-if="applicationIdentities(decideModal.row).length" style="margin:4px 0 0 18px;padding:0;line-height:1.8;">
                <li v-for="(identity, index) in applicationIdentities(decideModal.row)" :key="identity.id || identity._id || `${identity.nickname}-${index}`">
                  {{ index === 0 ? '主身份' : `副身份 ${index}` }}：{{ identityText(identity) }}
                </li>
              </ul>
              <p v-else>-</p>
            </template>
            <template v-else-if="decideModal.row?.type === 'identity'">
              <p>用户：{{ decideModal.row?.user_id?.username || '-' }}</p>
              <p>QQ：{{ decideModal.row?.user_id?.qq || '-' }}</p>
              <p>新增身份：{{ identityText(decideModal.row?.payload?.identity) }}</p>
            </template>
            <template v-else>
              <p>用户：{{ decideModal.row?.user_id?.username || '-' }}</p>
              <p>素材：{{ decideModal.row?.payload?.item_name || '-' }}</p>
              <p v-if="decideModal.row?.payload?.reason">回购原因：{{ decideModal.row?.payload?.reason }}</p>
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
              <label class="form-label">
                {{ decideModal.decision === 'rejected' ? '拒绝说明' : '备注（可选）' }}
              </label>
              <textarea
                v-model="decideModal.remark"
                class="form-textarea"
                rows="4"
                :placeholder="decideModal.decision === 'rejected' ? '填写给用户的说明，注册审核拒绝时会通过邮件发送' : '审批备注...'"
              />
            </div>
          </div>
          <div v-else>
            <div class="form-group">
              <label class="form-label">审批结果</label>
              <div>
                <span class="status-badge" :class="decideModal.row?.status">{{ statusLabel(decideModal.row?.status) }}</span>
              </div>
            </div>
            <div v-if="decideModal.row?.remark || decideModal.row?.admin_remark" class="form-group mt-3">
              <label class="form-label">审批备注</label>
              <div class="text-sm text-muted">{{ decideModal.row?.remark || decideModal.row?.admin_remark }}</div>
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

const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)

const filters = ref({ type: '', status: 'pending' })

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
    if (filters.value.type) params.type = filters.value.type
    if (filters.value.status) params.status = filters.value.status
    const res = await applicationsAPI.getAll(params)
    rows.value = res.applications || res.data || []
    total.value = res.total || rows.value.length
  } catch {
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function search() { page.value = 1; loadData() }
function resetFilters() { filters.value = { type: '', status: 'pending' }; page.value = 1; loadData() }
function changePage(p) { page.value = p; loadData() }

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-CN')
}

function typeLabel(type) {
  const map = { registration: '注册审核', identity: '身份审核', buyback: '素材回购' }
  return map[type] || type || '-'
}

function statusLabel(s) {
  const map = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
  return map[s] || s
}

function applicantName(row) {
  return row.user_id?.username || row.payload?.username || '-'
}

function applicantMeta(row) {
  if (row.type === 'registration') {
    return row.user_id?.qq || row.payload?.qq || row.user_id?.email || row.payload?.email || '-'
  }
  if (row.type === 'identity') {
    return row.user_id?.qq || row.user_id?.email || '-'
  }
  return row.user_id?.qq || row.user_id?.platform_id || row.user_id?.email || '-'
}

function applicationTitle(row) {
  if (row.type === 'registration') {
    const identities = applicationIdentities(row)
    const first = identities[0]
    return first ? `登记身份：${first.nickname || '-'}${identities.length > 1 ? ` 等 ${identities.length} 个` : ''}` : `UID：${row.user_id?.uid || row.payload?.uid || '-'}`
  }
  if (row.type === 'identity') {
    return `新增身份：${row.payload?.identity?.nickname || '-'}`
  }
  return row.payload?.item_name || '-'
}

function applicationSubTitle(row) {
  if (row.type === 'registration') return applicationIdentities(row).map(identityText).join('；')
  if (row.type === 'identity') return identityText(row.payload?.identity)
  return row.payload?.reason || ''
}

function applicationIdentities(row) {
  if (!row) return []
  if (Array.isArray(row.payload?.identities) && row.payload.identities.length) return row.payload.identities
  if (row.payload?.identity) return [row.payload.identity]
  if (Array.isArray(row.user_id?.identities)) return row.user_id.identities
  return []
}

function identityText(identity) {
  if (!identity) return '-'
  return [identity.role, identity.platform, identity.nickname, identity.uid ? `UID：${identity.uid}` : ''].filter(Boolean).join(' / ') || '-'
}

const decideModal = ref({
  show: false, row: null, loading: false,
  decision: 'approved', remark: ''
})

function openDecide(row) {
  decideModal.value = {
    show: true,
    row,
    loading: false,
    decision: 'approved',
    remark: ''
  }
}

async function submitDecide() {
  decideModal.value.loading = true
  try {
    const res = await applicationsAPI.decide(decideModal.value.row._id, {
      status: decideModal.value.decision,
      remark: decideModal.value.remark
    })
    addToast(
      'success',
      '审批成功',
      res.message || `申请已${decideModal.value.decision === 'approved' ? '通过' : '拒绝'}`
    )
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
