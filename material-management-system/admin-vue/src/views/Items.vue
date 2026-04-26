<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">店铺素材</h1>
        <p class="page-subtitle">管理素材、预览图与授权名单</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" @click="showImport = !showImport">批量导入</button>
        <router-link to="/items/new" class="btn btn-primary">+ 新增素材</router-link>
      </div>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <div class="search-group">
        <label class="search-label">素材名称</label>
        <input v-model="search.name" class="search-input" placeholder="搜索素材名称..." @keyup.enter="doSearch" />
      </div>
      <div class="search-group">
        <label class="search-label">状态</label>
        <select v-model="search.status" class="search-input">
          <option value="">全部</option>
          <option value="on_sale">在售</option>
          <option value="completed">结车</option>
          <option value="off_sale">下架</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="doSearch">搜索</button>
      <button class="btn btn-secondary" @click="resetSearch">重置</button>
    </div>

    <!-- Batch Import -->
    <div v-if="showImport" class="table-container" style="margin-bottom:16px;">
      <div class="table-toolbar">
        <span class="table-title">批量导入店铺素材</span>
      </div>
      <div style="padding:16px;">
        <p class="text-sm text-muted" style="margin-bottom:8px;">请输入 JSON 数组，每个对象包含：sku_code, preview_url, name(必填), material_domain（文游类/美工美化类）, topics, artist(必填), price(必填), delivery_link, status（在售/结车/下架）</p>
        <div style="background:#f9fafb;padding:8px 12px;border-radius:6px;font-size:0.8rem;margin-bottom:12px;overflow-x:auto;">
          <pre style="margin:0;">[
  { "sku_code": "260101", "preview_url": "https://...", "name": "素材A", "material_domain": "美工美化类", "artist": "画师X", "price": 100, "topics": ["立绘","CG"], "delivery_link": "https://...", "status": "在售" },
  { "sku_code": "260102", "name": "素材B", "material_domain": "文游类", "artist": "画师Y", "price": 200, "topics": "场景/封面", "status": "结车" }
]</pre>
        </div>
        <textarea
          v-model="importJson"
          class="form-input"
          rows="6"
          placeholder="粘贴 JSON 数组..."
          style="font-family:monospace;font-size:0.85rem;width:100%;"
        ></textarea>
        <div v-if="importError" class="form-error" style="margin-top:6px;">{{ importError }}</div>
        <div v-if="importResult" style="margin-top:6px;font-size:0.85rem;color:var(--text-secondary,#6b7280);">{{ importResult }}</div>
        <div style="margin-top:10px;display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" :disabled="importing" @click="doImport">
            {{ importing ? '导入中...' : '开始导入' }}
          </button>
          <button class="btn btn-secondary btn-sm" @click="showImport = false">收起</button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div class="table-toolbar">
        <span class="table-title">共 {{ total }} 件素材</span>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--border,#e5e7eb);">
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">SKU</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">结车图</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">素材名称</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">归类</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">画师</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">价格(pts)</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">状态</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="table-loading">加载中...</td>
          </tr>
          <tr v-else-if="items.length === 0">
            <td colspan="8" class="table-empty">暂无素材数据</td>
          </tr>
          <template v-else>
            <tr v-for="item in items" :key="item._id" class="table-row-hover">
              <td style="padding:10px 16px;font-size:13px;color:var(--text-secondary,#6b7280);">{{ item.sku_code || '—' }}</td>
              <td style="padding:10px 16px;">
                <img v-if="item.preview_url" :src="item.preview_url" class="preview-img" alt="结车图" style="width:56px;height:40px;object-fit:cover;border-radius:4px;" />
                <div v-else class="img-placeholder" style="width:56px;height:40px;display:flex;align-items:center;justify-content:center;">无图</div>
              </td>
              <td style="padding:10px 16px;font-weight:500;">{{ item.name }}</td>
              <td style="padding:10px 16px;color:var(--text-secondary,#6b7280);">{{ item.material_domain || '美工美化类' }}</td>
              <td style="padding:10px 16px;color:var(--text-secondary,#6b7280);">{{ item.artist || '—' }}</td>
              <td style="padding:10px 16px;">{{ item.price }}</td>
              <td style="padding:10px 16px;">
                <span :class="['status-badge', statusClass(item.status)]">
                  {{ statusLabel(item.status) }}
                </span>
              </td>
              <td style="padding:10px 16px;">
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <router-link :to="`/items/${item._id}/edit`" class="btn btn-sm btn-secondary">编辑</router-link>
                  <router-link :to="`/items/${item._id}/ownerships`" class="btn btn-sm btn-secondary">授权名单</router-link>
                  <button
                    :class="['btn', 'btn-sm', item.status === 'on_sale' ? 'btn-warning' : 'btn-primary']"
                    :disabled="!!toggling[item._id]"
                    @click="toggleStatus(item)"
                  >
                    {{ toggling[item._id] ? '处理中...' : (item.status === 'on_sale' ? '结车' : '上架') }}
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="total > pageSize" class="pagination">
        <span class="pagination-info">第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条</span>
        <div class="pagination-controls">
          <button class="page-btn" :disabled="page <= 1" @click="changePage(page - 1)">&laquo;</button>
          <button
            v-for="p in visiblePages"
            :key="p"
            :class="['page-btn', { active: p === page }]"
            @click="changePage(p)"
          >{{ p }}</button>
          <button class="page-btn" :disabled="page >= totalPages" @click="changePage(page + 1)">&raquo;</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, inject, onMounted } from 'vue'
import { itemsAPI } from '@/api/index.js'

const _addToast = inject('addToast')
function addToast(message, type = 'success') { _addToast(type, message) }

// ── State ────────────────────────────────────────────────────────────────────
const items = ref([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = 15
const toggling = reactive({})

const search = ref({ name: '', status: '' })

// ── Batch Import ─────────────────────────────────────────────────────────────
const showImport = ref(false)
const importJson = ref('')
const importError = ref('')
const importResult = ref('')
const importing = ref(false)

async function doImport() {
  importError.value = ''
  importResult.value = ''
  let rows
  try {
    rows = JSON.parse(importJson.value)
    if (!Array.isArray(rows)) throw new Error('需要 JSON 数组')
  } catch (e) {
    importError.value = 'JSON 解析失败：' + e.message
    return
  }
  importing.value = true
  try {
    const res = await itemsAPI.importBatch({ items: rows })
    importResult.value = res.message || '导入完成'
    if (res.errors?.length) {
      importResult.value += '；失败项：' + res.errors.map(e => `${e.name}(${e.error})`).join('、')
    }
    fetchItems()
  } catch (e) {
    importError.value = e?.message || '导入请求失败'
  } finally {
    importing.value = false
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, page.value - 2)
  const end = Math.min(totalPages.value, start + 4)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

function statusLabel(status) {
  if (status === 'on_sale') return '在售'
  if (status === 'completed') return '结车'
  if (status === 'off_sale') return '下架'
  return status
}

function statusClass(status) {
  if (status === 'on_sale') return 'active'
  if (status === 'completed') return 'inactive'
  return 'inactive'
}

// ── API ───────────────────────────────────────────────────────────────────────
async function fetchItems() {
  loading.value = true
  try {
    const params = { page: page.value, limit: pageSize }
    if (search.value.name) params.name = search.value.name
    if (search.value.status) params.status = search.value.status
    const data = await itemsAPI.getAll(params)
    items.value = data.items || []
    total.value = data.total || 0
  } catch {
    addToast('加载店铺素材失败', 'error')
  } finally {
    loading.value = false
  }
}

function doSearch() { page.value = 1; fetchItems() }
function resetSearch() { search.value = { name: '', status: '' }; page.value = 1; fetchItems() }
function changePage(p) { if (p < 1 || p > totalPages.value) return; page.value = p; fetchItems() }

async function toggleStatus(item) {
  const newStatus = item.status === 'on_sale' ? 'completed' : 'on_sale'
  toggling[item._id] = true
  try {
    await itemsAPI.update(item._id, { status: newStatus })
    item.status = newStatus
    addToast(`已${statusLabel(newStatus)}：${item.name}`, 'success')
  } catch (e) {
    addToast(e?.message || '操作失败，请重试', 'error')
  } finally {
    delete toggling[item._id]
  }
}

onMounted(fetchItems)
</script>
