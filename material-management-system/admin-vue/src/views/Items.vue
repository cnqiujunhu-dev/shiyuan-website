<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">商品列表</h1>
        <p class="page-subtitle">管理所有在售及下架商品</p>
      </div>
      <router-link to="/items/new" class="btn btn-primary">+ 新增商品</router-link>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <div class="search-group">
        <label class="search-label">商品名称</label>
        <input v-model="search.name" class="search-input" placeholder="搜索商品名称..." @keyup.enter="doSearch" />
      </div>
      <div class="search-group">
        <label class="search-label">状态</label>
        <select v-model="search.status" class="search-input">
          <option value="">全部</option>
          <option value="on_sale">上架</option>
          <option value="off_sale">下架</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="doSearch">搜索</button>
      <button class="btn btn-secondary" @click="resetSearch">重置</button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div class="table-toolbar">
        <span class="table-title">共 {{ total }} 件商品</span>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--border,#e5e7eb);">
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">预览图</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">商品名称</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">作者</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">分类标签</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">价格(pts)</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">状态</th>
            <th style="padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:var(--text-secondary,#6b7280);">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="table-loading">加载中...</td>
          </tr>
          <tr v-else-if="items.length === 0">
            <td colspan="7" class="table-empty">暂无商品数据</td>
          </tr>
          <template v-else>
            <tr v-for="item in items" :key="item._id" class="table-row-hover">
              <td style="padding:10px 16px;">
                <img v-if="item.preview_url" :src="item.preview_url" class="preview-img" alt="预览图" style="width:56px;height:40px;object-fit:cover;border-radius:4px;" />
                <div v-else class="img-placeholder" style="width:56px;height:40px;display:flex;align-items:center;justify-content:center;">无图</div>
              </td>
              <td style="padding:10px 16px;font-weight:500;">{{ item.name }}</td>
              <td style="padding:10px 16px;color:var(--text-secondary,#6b7280);">{{ item.artist || '—' }}</td>
              <td style="padding:10px 16px;">
                <div class="tags-wrap">
                  <span v-for="cat in (item.categories || [])" :key="cat" class="tag">{{ cat }}</span>
                  <span v-if="!item.categories || item.categories.length === 0" style="color:var(--text-muted,#9ca3af);font-size:13px;">—</span>
                </div>
              </td>
              <td style="padding:10px 16px;">{{ item.price }}</td>
              <td style="padding:10px 16px;">
                <span :class="['status-badge', item.status === 'on_sale' ? 'active' : 'inactive']">
                  {{ item.status === 'on_sale' ? '上架' : '下架' }}
                </span>
              </td>
              <td style="padding:10px 16px;">
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <router-link :to="`/items/${item._id}/edit`" class="btn btn-sm btn-secondary">编辑</router-link>
                  <button
                    :class="['btn', 'btn-sm', item.status === 'on_sale' ? 'btn-warning' : 'btn-primary']"
                    :disabled="!!toggling[item._id]"
                    @click="toggleStatus(item)"
                  >
                    {{ toggling[item._id] ? '处理中...' : (item.status === 'on_sale' ? '下架' : '上架') }}
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

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, page.value - 2)
  const end = Math.min(totalPages.value, start + 4)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

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
    addToast('加载商品列表失败', 'error')
  } finally {
    loading.value = false
  }
}

function doSearch() { page.value = 1; fetchItems() }
function resetSearch() { search.value = { name: '', status: '' }; page.value = 1; fetchItems() }
function changePage(p) { if (p < 1 || p > totalPages.value) return; page.value = p; fetchItems() }

async function toggleStatus(item) {
  const newStatus = item.status === 'on_sale' ? 'off_sale' : 'on_sale'
  toggling[item._id] = true
  try {
    await itemsAPI.update(item._id, { status: newStatus })
    item.status = newStatus
    addToast(`已${newStatus === 'on_sale' ? '上架' : '下架'}：${item.name}`, 'success')
  } catch {
    addToast('操作失败，请重试', 'error')
  } finally {
    delete toggling[item._id]
  }
}

onMounted(fetchItems)
</script>
