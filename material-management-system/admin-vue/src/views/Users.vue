<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">用户管理</div>
        <div class="page-subtitle">查询与修改平台注册用户</div>
      </div>
    </div>

    <div class="page">
      <!-- Search -->
      <div class="search-bar">
        <div class="search-group">
          <label class="search-label">搜索</label>
          <input
            v-model="filters.q"
            class="search-input"
            placeholder="用户名 / QQ / 平台ID"
            style="min-width:220px"
            @keyup.enter="search"
          />
        </div>
        <button class="btn btn-primary btn-sm" @click="search">搜索</button>
        <button class="btn btn-secondary btn-sm" @click="resetFilters">重置</button>
      </div>

      <!-- Table -->
      <div class="table-container table-row-hover">
        <div class="table-toolbar">
          <span class="table-title">共 {{ total }} 位用户</span>
        </div>

        <div v-if="loading" class="table-loading">加载中...</div>
        <div v-else-if="rows.length === 0" class="table-empty">暂无用户数据</div>
        <table v-else>
          <thead>
            <tr>
              <th>用户名</th>
              <th>邮箱</th>
              <th>QQ</th>
              <th>平台</th>
              <th>平台 ID</th>
              <th>VIP 等级</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td style="font-weight:500">{{ row.username }}</td>
              <td class="text-muted text-sm">{{ maskEmail(row.email) }}</td>
              <td class="text-muted">{{ row.qq || '-' }}</td>
              <td>{{ row.platform || '-' }}</td>
              <td>{{ row.platform_id || '-' }}</td>
              <td>
                <span v-if="row.vip_level" class="vip-badge" :class="`vip${row.vip_level}`">
                  VIP{{ row.vip_level }}
                </span>
                <span v-else class="vip-badge none">无</span>
              </td>
              <td class="text-sm text-muted">{{ formatDate(row.created_at) }}</td>
              <td>
                <button class="btn btn-ghost btn-sm" @click="openEdit(row)">编辑平台信息</button>
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

    <!-- Edit Modal -->
    <div v-if="editModal.show" class="modal-overlay" @click.self="editModal.show = false">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">编辑平台信息 - {{ editModal.row?.username }}</span>
          <button class="modal-close" @click="editModal.show = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="info-text mb-3" style="font-size:12px">
            修改用户的平台信息，通常用于用户申请更换平台后管理员手动同步，或纠正历史数据。修改 QQ 号前请确认用户身份。
          </div>
          <div class="form-group mb-3">
            <label class="form-label">平台</label>
            <input v-model="editModal.form.platform" class="form-input" placeholder="如：易次元、橙光" />
          </div>
          <div class="form-group mb-3">
            <label class="form-label">平台 ID / 昵称</label>
            <input v-model="editModal.form.platform_id" class="form-input" placeholder="在平台上的昵称或 ID" />
          </div>
          <div class="form-group">
            <label class="form-label">QQ 号</label>
            <input v-model="editModal.form.qq" class="form-input" placeholder="QQ 号码" />
            <span class="form-hint">修改 QQ 号将影响交易记录的关联查询</span>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { usersAPI } from '../api/index.js'

const addToast = inject('addToast')

const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)

const filters = ref({ q: '' })

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
    if (filters.value.q) params.q = filters.value.q
    const res = await usersAPI.getAll(params)
    rows.value = res.users || res.data || []
    total.value = res.total || rows.value.length
  } catch {
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function search() { page.value = 1; loadData() }
function resetFilters() { filters.value = { q: '' }; page.value = 1; loadData() }
function changePage(p) { page.value = p; loadData() }

function maskEmail(email) {
  if (!email) return '-'
  const [local, domain] = email.split('@')
  if (!domain) return email
  const masked = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : local[0] + '*'
  return `${masked}@${domain}`
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-CN')
}

// Edit Modal
const editModal = ref({ show: false, row: null, loading: false, form: { platform: '', platform_id: '', qq: '' } })

function openEdit(row) {
  editModal.value = {
    show: true,
    row,
    loading: false,
    form: { platform: row.platform || '', platform_id: row.platform_id || '', qq: row.qq || '' }
  }
}

async function submitEdit() {
  editModal.value.loading = true
  try {
    await usersAPI.update(editModal.value.row.id, editModal.value.form)
    addToast('success', '修改成功', '用户平台信息已更新')
    editModal.value.show = false
    loadData()
  } catch (e) {
    addToast('error', '修改失败', e.message)
  } finally {
    editModal.value.loading = false
  }
}

onMounted(loadData)
</script>
