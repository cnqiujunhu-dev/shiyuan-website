<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">授权名单</h1>
        <p class="page-subtitle">{{ item?.name || '店铺素材' }}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary" :disabled="exporting" @click="exportCsv">
          {{ exporting ? '导出中...' : '导出 CSV' }}
        </button>
        <router-link to="/items" class="btn btn-secondary">&larr; 返回素材</router-link>
      </div>
    </div>

    <div v-if="loading" style="padding:48px;text-align:center;color:var(--text-muted,#9ca3af);">
      加载中...
    </div>

    <div v-else class="table-container">
      <div class="table-toolbar">
        <span class="table-title">共 {{ total }} 条授权记录</span>
      </div>
      <div v-if="rows.length === 0" class="table-empty">暂无授权记录</div>
      <table v-else>
        <thead>
          <tr>
            <th>使用领域</th>
            <th>获取途径</th>
            <th>用途</th>
            <th>购买人</th>
            <th>实际使用人</th>
            <th>积分</th>
            <th>年度消费</th>
            <th>发货链接</th>
            <th>获取时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row._id">
            <td>{{ row.usage_field || row.identity_role || '-' }}</td>
            <td><span :class="['badge', methodBadgeClass(row.acquisition_method)]">{{ row.acquisition_method || typeLabel(row.acquisition_type) }}</span></td>
            <td>{{ row.usage_purpose || '-' }}</td>
            <td class="text-sm">{{ personLabel(row, 'purchaser') }}</td>
            <td class="text-sm">{{ personLabel(row, 'actual') }}</td>
            <td>{{ row.points_delta || 0 }}</td>
            <td>{{ row.annual_spend_delta || 0 }}</td>
            <td class="link-cell">
              <a v-if="row.delivery_link" :href="row.delivery_link" target="_blank" rel="noopener">查看链接</a>
              <span v-else class="text-muted">-</span>
            </td>
            <td class="text-sm text-muted">{{ formatDate(row.occurred_at) }}</td>
            <td>
              <button class="btn btn-secondary btn-sm" @click="openEdit(row)">编辑</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div v-if="editModal.visible" class="modal-overlay" @click.self="closeEdit">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">编辑授权记录</span>
            <button class="modal-close" @click="closeEdit">✕</button>
          </div>
          <div class="form-group">
            <label class="form-label">使用领域</label>
            <select v-model="editForm.usage_field" class="form-input">
              <option value="文游作者">文游作者</option>
              <option value="小说作者">小说作者</option>
              <option value="非重氪独立游戏作者">非重氪独立游戏作者</option>
              <option value="美工">美工</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">获取途径</label>
            <select v-model="editForm.acquisition_method" class="form-input">
              <option value="购买">购买</option>
              <option value="活动购买">活动购买</option>
              <option value="被赞助">被赞助</option>
              <option value="回购">回购</option>
              <option value="会员帮回购">会员帮回购</option>
              <option value="中奖">中奖</option>
              <option value="退圈掉落">退圈掉落</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">用途</label>
            <select v-model="editForm.usage_purpose" class="form-input">
              <option value="自用">自用</option>
              <option value="赞助待定">赞助待定</option>
              <option value="赞助确定">赞助确定</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">积分</label>
            <input v-model.number="editForm.points_delta" type="number" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">年度消费</label>
            <input v-model.number="editForm.annual_spend_delta" type="number" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">发货链接</label>
            <input v-model="editForm.delivery_link" type="text" class="form-input" placeholder="https://..." />
          </div>
          <div v-if="editModal.error" class="form-error" style="margin-bottom:10px;">{{ editModal.error }}</div>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="closeEdit">取消</button>
            <button class="btn btn-primary" :disabled="editModal.saving" @click="saveEdit">
              {{ editModal.saving ? '保存中...' : '保存修改' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { itemsAPI } from '../api/index.js'

const route = useRoute()
const _addToast = inject('addToast')
function addToast(message, type = 'success') { _addToast(type, message) }

const item = ref(null)
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const exporting = ref(false)

const editModal = reactive({ visible: false, row: null, saving: false, error: '' })
const editForm = reactive({
  usage_field: '美工',
  acquisition_method: '购买',
  usage_purpose: '自用',
  points_delta: 0,
  annual_spend_delta: 0,
  delivery_link: ''
})

function typeLabel(type) {
  const map = { self: '自用', sponsor: '已赞助', sponsored: '被赞助', sponsor_pending: '赞助待定', transfer_in: '自用', transfer_out: '转出记录' }
  return map[type] || type
}

function typeBadgeClass(type) {
  const map = { self: 'badge-success', sponsor: 'badge-info', sponsored: 'badge-warning', sponsor_pending: 'badge-default' }
  return map[type] || 'badge-default'
}

function methodBadgeClass(method) {
  const map = {
    '购买': 'badge-success',
    '活动购买': 'badge-info',
    '被赞助': 'badge-warning',
    '回购': 'badge-default',
    '会员帮回购': 'badge-default',
    '中奖': 'badge-info',
    '退圈掉落': 'badge-warning'
  }
  return map[method] || 'badge-default'
}

function displayUser(user) {
  return user?.platform_id || user?.username || user?.qq || '-'
}

function personLabel(row, type) {
  if (type === 'purchaser') {
    const id = row.purchaser_display_id || row.purchaser_user_id?.platform_id || row.purchaser_user_id?.username || ''
    const qq = row.purchaser_qq || row.purchaser_user_id?.qq || ''
    return [id, qq].filter(Boolean).join(' / ') || '-'
  }
  const id = row.actual_display_id || row.actual_user_id?.platform_id || row.actual_user_id?.username || ''
  const qq = row.actual_qq || row.actual_user_id?.qq || ''
  return [id, qq].filter(Boolean).join(' / ') || '-'
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

async function loadData() {
  loading.value = true
  try {
    const [itemRes, ownershipRes] = await Promise.all([
      itemsAPI.getById(route.params.id),
      itemsAPI.getOwnerships(route.params.id, { limit: 100 })
    ])
    item.value = itemRes.item || itemRes
    rows.value = ownershipRes.ownerships || []
    total.value = ownershipRes.total || rows.value.length
  } catch (e) {
    addToast(e?.message || '加载授权名单失败', 'error')
  } finally {
    loading.value = false
  }
}

function openEdit(row) {
  editModal.visible = true
  editModal.row = row
  editModal.error = ''
  editForm.usage_field = row.usage_field || row.identity_role || '美工'
  editForm.acquisition_method = row.acquisition_method || '购买'
  editForm.usage_purpose = row.usage_purpose || '自用'
  editForm.points_delta = row.points_delta || 0
  editForm.annual_spend_delta = row.annual_spend_delta || 0
  editForm.delivery_link = row.delivery_link || ''
}

function closeEdit() {
  editModal.visible = false
  editModal.row = null
  editModal.error = ''
}

async function saveEdit() {
  if (!editModal.row) return
  editModal.saving = true
  editModal.error = ''
  try {
    await itemsAPI.updateOwnership(route.params.id, editModal.row._id, {
      usage_field: editForm.usage_field,
      acquisition_method: editForm.acquisition_method,
      usage_purpose: editForm.usage_purpose,
      points_delta: editForm.points_delta,
      annual_spend_delta: editForm.annual_spend_delta,
      delivery_link: editForm.delivery_link
    })
    addToast('授权记录已更新')
    closeEdit()
    loadData()
  } catch (e) {
    editModal.error = e?.message || '保存失败'
  } finally {
    editModal.saving = false
  }
}

async function exportCsv() {
  exporting.value = true
  try {
    const name = item.value?.sku_code || item.value?.name || route.params.id
    await itemsAPI.exportOwnerships(route.params.id, `${name}-授权名单.csv`)
  } catch (e) {
    addToast(e?.message || '导出失败', 'error')
  } finally {
    exporting.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.link-cell {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge-info {
  background: #dbeafe;
  color: #1d4ed8;
}
</style>
