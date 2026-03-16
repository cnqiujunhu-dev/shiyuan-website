<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ isEdit ? '编辑商品' : '新增商品' }}</h1>
        <p class="page-subtitle">{{ isEdit ? '修改商品信息' : '添加新的素材商品' }}</p>
      </div>
      <router-link to="/items" class="btn btn-secondary">← 返回列表</router-link>
    </div>

    <div v-if="loadingItem" style="padding:48px;text-align:center;color:var(--text-muted,#9ca3af);">
      加载中...
    </div>

    <form v-else class="form-card" @submit.prevent="handleSubmit">
      <div class="form-section">
        <div class="form-section-title">基本信息</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">商品名称 <span style="color:#ef4444;">*</span></label>
            <input v-model="form.name" type="text" class="form-input" placeholder="请输入商品名称" required />
            <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
          </div>
          <div class="form-group">
            <label class="form-label">作者 <span style="color:#ef4444;">*</span></label>
            <input v-model="form.artist" type="text" class="form-input" placeholder="请输入作者名称" required />
            <span v-if="errors.artist" class="form-error">{{ errors.artist }}</span>
          </div>
          <div class="form-group">
            <label class="form-label">价格(pts) <span style="color:#ef4444;">*</span></label>
            <input v-model.number="form.price" type="number" min="0" class="form-input" placeholder="请输入价格" required />
            <span v-if="errors.price" class="form-error">{{ errors.price }}</span>
          </div>
          <div class="form-group">
            <label class="form-label">状态</label>
            <select v-model="form.status" class="form-select">
              <option value="on_sale">上架</option>
              <option value="off_sale">下架</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">分类标签</div>
        <div class="form-group">
          <label class="form-label">添加标签（输入后按 Enter）</label>
          <input
            v-model="tagInput"
            type="text"
            class="form-input"
            placeholder="输入标签后按 Enter 添加..."
            style="max-width:320px;"
            @keydown.enter.prevent="addTag"
          />
          <span class="form-hint">按 Enter 键确认添加标签</span>
          <div v-if="form.categories.length > 0" class="tags-wrap" style="margin-top:10px;">
            <span v-for="(cat, idx) in form.categories" :key="cat" class="tag" style="display:inline-flex;align-items:center;gap:4px;">
              {{ cat }}
              <button type="button" style="background:none;border:none;cursor:pointer;padding:0;line-height:1;color:inherit;opacity:0.7;" @click="removeTag(idx)">×</button>
            </span>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">素材链接</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">预览图URL</label>
            <input v-model="form.preview_url" type="text" class="form-input" placeholder="https://..." />
            <span class="form-hint">商品列表和详情页展示的预览图地址</span>
          </div>
          <div class="form-group">
            <label class="form-label">下载链接 <span style="color:#ef4444;">*</span></label>
            <input v-model="form.delivery_link" type="text" class="form-input" placeholder="https://..." required />
            <span class="form-hint">购买后用户可见的素材下载链接</span>
            <span v-if="errors.delivery_link" class="form-error">{{ errors.delivery_link }}</span>
          </div>
        </div>
      </div>

      <div v-if="submitError" class="form-error" style="margin-bottom:12px;">{{ submitError }}</div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? '保存中...' : (isEdit ? '保存修改' : '创建商品') }}
        </button>
        <router-link to="/items" class="btn btn-secondary">取消</router-link>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { itemsAPI } from '@/api/index.js'

const _addToast = inject('addToast')
function addToast(message, type = 'success') { _addToast(type, message) }

// ── Route ─────────────────────────────────────────────────────────────────────
const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)

// ── Form state ────────────────────────────────────────────────────────────────
const loadingItem = ref(false)
const saving = ref(false)
const submitError = ref('')
const errors = ref({})
const tagInput = ref('')

const form = ref({
  name: '',
  artist: '',
  price: '',
  status: 'on_sale',
  categories: [],
  preview_url: '',
  delivery_link: ''
})

// ── Tag management ────────────────────────────────────────────────────────────
function addTag() {
  const val = tagInput.value.trim()
  if (val && !form.value.categories.includes(val)) {
    form.value.categories.push(val)
  }
  tagInput.value = ''
}

function removeTag(idx) {
  form.value.categories.splice(idx, 1)
}

// ── Validation ────────────────────────────────────────────────────────────────
function validate() {
  const e = {}
  if (!form.value.name.trim()) e.name = '请输入商品名称'
  if (!form.value.artist.trim()) e.artist = '请输入作者名称'
  if (form.value.price === '' || form.value.price === null || isNaN(Number(form.value.price))) {
    e.price = '请输入有效的价格'
  }
  if (!form.value.delivery_link.trim()) e.delivery_link = '请输入下载链接'
  errors.value = e
  return Object.keys(e).length === 0
}

// ── Load for edit ─────────────────────────────────────────────────────────────
async function loadItem() {
  if (!isEdit.value) return
  loadingItem.value = true
  try {
    const res = await itemsAPI.getById(route.params.id)
    const item = res.item || res
    form.value = {
      name: item.name || '',
      artist: item.artist || '',
      price: item.price ?? '',
      status: item.status || 'on_sale',
      categories: item.categories || [],
      preview_url: item.preview_url || '',
      delivery_link: item.delivery_link || ''
    }
  } catch {
    addToast('加载商品信息失败', 'error')
  } finally {
    loadingItem.value = false
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit() {
  submitError.value = ''
  if (!validate()) return

  saving.value = true
  try {
    if (isEdit.value) {
      await itemsAPI.update(route.params.id, {
        name: form.value.name,
        artist: form.value.artist,
        price: Number(form.value.price),
        status: form.value.status,
        categories: form.value.categories,
        preview_url: form.value.preview_url,
        delivery_link: form.value.delivery_link
      })
    } else {
      const fd = new FormData()
      fd.append('name', form.value.name)
      fd.append('artist', form.value.artist)
      fd.append('price', String(Number(form.value.price)))
      fd.append('status', form.value.status)
      fd.append('categories', JSON.stringify(form.value.categories))
      fd.append('preview_url', form.value.preview_url)
      fd.append('delivery_link', form.value.delivery_link)
      await itemsAPI.create(fd)
    }
    router.push('/items')
  } catch (e) {
    submitError.value = e?.message || '操作失败，请重试'
    addToast(submitError.value, 'error')
  } finally {
    saving.value = false
  }
}

onMounted(loadItem)
</script>
