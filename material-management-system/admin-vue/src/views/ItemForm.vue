<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ isEdit ? '编辑素材' : '新增素材' }}</h1>
        <p class="page-subtitle">{{ isEdit ? '修改店铺素材信息' : '添加新的店铺素材' }}</p>
      </div>
      <router-link to="/items" class="btn btn-secondary">&larr; 返回列表</router-link>
    </div>

    <div v-if="loadingItem" style="padding:48px;text-align:center;color:var(--text-muted,#9ca3af);">
      加载中...
    </div>

    <form v-else class="form-card" @submit.prevent="handleSubmit">
      <div class="form-section">
        <div class="form-section-title">基本信息</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">SKU 编码</label>
            <input v-model="form.sku_code" type="text" class="form-input" placeholder="如 251202（年月+序号）" />
            <span class="form-hint">按时间顺序编码排序</span>
          </div>
          <div class="form-group">
            <label class="form-label">素材名称 <span style="color:#ef4444;">*</span></label>
            <input v-model="form.name" type="text" class="form-input" placeholder="请输入素材名称" required />
            <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
          </div>
          <div class="form-group">
            <label class="form-label">画师 <span style="color:#ef4444;">*</span></label>
            <input v-model="form.artist" type="text" class="form-input" placeholder="请输入画师名称" required />
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
              <option value="on_sale">在售</option>
              <option value="completed">结车</option>
              <option value="off_sale">下架</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">题材（隐性标签）</div>
        <div class="form-group">
          <label class="form-label">选择题材</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <label v-for="t in availableTopics" :key="t" class="checkbox-item" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid var(--border,#e5e7eb);border-radius:6px;cursor:pointer;font-size:0.85rem;" :style="{ background: form.topics.includes(t) ? 'var(--primary-light,#ede9fe)' : '' }">
              <input type="checkbox" :value="t" v-model="form.topics" style="margin:0;" />
              {{ t }}
            </label>
          </div>
          <label class="form-label" style="margin-top:8px;">自定义题材（输入后按 Enter）</label>
          <input
            v-model="topicInput"
            type="text"
            class="form-input"
            placeholder="输入自定义题材后按 Enter 添加..."
            style="max-width:320px;"
            @keydown.enter.prevent="addTopic"
          />
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
          <div v-if="form.categories.length > 0" class="tags-wrap" style="margin-top:10px;">
            <span v-for="(cat, idx) in form.categories" :key="cat" class="tag" style="display:inline-flex;align-items:center;gap:4px;">
              {{ cat }}
              <button type="button" style="background:none;border:none;cursor:pointer;padding:0;line-height:1;color:inherit;opacity:0.7;" @click="removeTag(idx)">&times;</button>
            </span>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">销售规则</div>
        <div class="form-grid">
          <div class="form-group" style="grid-column:1/-1;">
            <label class="checkbox-item">
              <input type="checkbox" v-model="form.priority_only" />
              设为 VIP 优先购素材
            </label>
            <div class="form-hint">开启后，非 VIP 用户无法购买该素材。</div>
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="checkbox-item">
              <input type="checkbox" v-model="form.queue_enabled" />
              开启排队限购
            </label>
            <div class="form-hint">插队权益已下线；该开关仅保留历史排队素材标记。</div>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">素材链接</div>
        <div class="form-grid">
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">结车图/预览图</label>
            <div style="display:flex;gap:12px;align-items:flex-start;">
              <div>
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;display:inline-block;">
                  选择图片上传
                  <input type="file" accept="image/*" style="display:none;" @change="onFileSelect" />
                </label>
                <span v-if="selectedFile" class="text-sm text-muted" style="margin-left:8px;">{{ selectedFile.name }}</span>
                <div class="form-hint" style="margin-top:4px;">支持 jpg/png/webp/gif，最大 5MB</div>
              </div>
              <div v-if="previewSrc" style="flex-shrink:0;">
                <img :src="previewSrc" alt="预览" style="max-width:120px;max-height:80px;border-radius:6px;border:1px solid var(--border,#e5e7eb);object-fit:cover;" />
              </div>
            </div>
            <div style="margin-top:8px;">
              <label class="form-label" style="font-size:0.8rem;color:var(--text-muted,#9ca3af);">或输入图片 URL</label>
              <input v-model="form.preview_url" type="text" class="form-input" placeholder="https://..." @input="onUrlInput" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">下载链接 <span style="color:#ef4444;">*</span></label>
            <input v-model="form.delivery_link" type="text" class="form-input" placeholder="https://..." required />
            <span class="form-hint">购买后用户可见的素材下载链接（网盘链接）</span>
            <span v-if="errors.delivery_link" class="form-error">{{ errors.delivery_link }}</span>
          </div>
        </div>
      </div>

      <div v-if="submitError" class="form-error" style="margin-bottom:12px;">{{ submitError }}</div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? '保存中...' : (isEdit ? '保存修改' : '创建素材') }}
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
const topicInput = ref('')

const availableTopics = ['立绘', 'CG', '场景', '通加', 'UI', '打光', '空境', '徽章', '封面']

const selectedFile = ref(null)
const previewSrc = ref('')

const form = ref({
  sku_code: '',
  name: '',
  artist: '',
  price: '',
  status: 'on_sale',
  priority_only: false,
  queue_enabled: false,
  topics: [],
  categories: [],
  preview_url: '',
  delivery_link: ''
})

function onFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  selectedFile.value = file
  previewSrc.value = URL.createObjectURL(file)
  form.value.preview_url = '' // 文件上传优先，清除URL
}

function onUrlInput() {
  if (form.value.preview_url) {
    selectedFile.value = null
    previewSrc.value = form.value.preview_url
  }
}

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

function addTopic() {
  const val = topicInput.value.trim()
  if (val && !form.value.topics.includes(val)) {
    form.value.topics.push(val)
  }
  topicInput.value = ''
}

// ── Validation ────────────────────────────────────────────────────────────────
function validate() {
  const e = {}
  if (!form.value.name.trim()) e.name = '请输入素材名称'
  if (!form.value.artist.trim()) e.artist = '请输入画师名称'
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
      sku_code: item.sku_code || '',
      name: item.name || '',
      artist: item.artist || '',
      price: item.price ?? '',
      status: item.status || 'on_sale',
      priority_only: !!item.priority_only,
      queue_enabled: !!item.queue_enabled,
      topics: item.topics || [],
      categories: item.categories || [],
      preview_url: item.preview_url || '',
      delivery_link: item.delivery_link || ''
    }
    if (item.preview_url) previewSrc.value = item.preview_url
  } catch {
    addToast('加载素材信息失败', 'error')
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
    const fd = new FormData()
    fd.append('sku_code', form.value.sku_code)
    fd.append('name', form.value.name)
    fd.append('artist', form.value.artist)
    fd.append('price', String(Number(form.value.price)))
    fd.append('status', form.value.status)
    fd.append('priority_only', String(!!form.value.priority_only))
    fd.append('queue_enabled', String(!!form.value.queue_enabled))
    fd.append('topics', JSON.stringify(form.value.topics))
    fd.append('categories', JSON.stringify(form.value.categories))
    fd.append('delivery_link', form.value.delivery_link)
    if (selectedFile.value) {
      fd.append('preview', selectedFile.value)
    } else {
      fd.append('preview_url', form.value.preview_url)
    }

    if (isEdit.value) {
      await itemsAPI.update(route.params.id, fd)
    } else {
      await itemsAPI.create(fd)
    }
    addToast(isEdit.value ? '素材已更新' : '素材创建成功')
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
