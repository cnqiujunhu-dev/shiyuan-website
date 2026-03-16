<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">店铺授权</h1>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <select v-model="filters.topic" class="form-input" style="min-width:120px;">
        <option value="">全部题材</option>
        <option v-for="t in topics" :key="t" :value="t">{{ t }}</option>
      </select>
      <input
        v-model="filters.artist"
        type="text"
        class="form-input"
        placeholder="画师名称"
        style="min-width:130px;"
        @keyup.enter="loadItems(1)"
      />
      <button class="btn btn-primary btn-sm" @click="loadItems(1)">搜索</button>
      <button class="btn btn-ghost btn-sm" @click="resetFilters">重置</button>
    </div>

    <!-- Loading -->
    <div class="loading-wrap" v-if="loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-else-if="!loading && items.length === 0">
      <div class="empty-state-icon">🏪</div>
      <div class="empty-state-title">暂无商品</div>
      <div class="empty-state-desc">店铺暂时没有商品，请稍后再来</div>
    </div>

    <!-- Shop Grid -->
    <div class="shop-grid" v-else>
      <div
        class="shop-card"
        v-for="item in items"
        :key="item._id || item.id"
      >
        <div class="shop-card-image">
          <img
            v-if="item.preview_url"
            :src="item.preview_url"
            :alt="item.name"
            @error="e => e.target.style.display='none'"
          />
          <span v-else>🖼️</span>
        </div>
        <div class="shop-card-body">
          <div class="shop-card-name" :title="item.name">{{ item.name }}</div>
          <div class="shop-card-meta">
            <span v-if="item.artist">画师：{{ item.artist }}</span>
          </div>
          <div class="asset-tags" v-if="getTags(item).length" style="margin-bottom:8px;">
            <span
              v-for="tag in getTags(item)"
              :key="tag"
              class="badge badge-primary"
            >{{ tag }}</span>
          </div>
          <div class="shop-card-price">
            <span v-if="item.price">¥{{ item.price }}</span>
            <span v-else class="text-muted text-sm">价格面议</span>
          </div>
          <button
            class="btn btn-primary btn-sm"
            style="width:100%;"
            @click="openSponsorModal(item)"
          >赞助给他人</button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <Pagination :total="total" :page="page" :limit="limit" @change="loadItems" />

    <!-- Sponsor Modal -->
    <Teleport to="body">
      <div v-if="sponsorModal.visible" class="modal-overlay" @click.self="closeSponsorModal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">赞助给他人</span>
            <button class="modal-close" @click="closeSponsorModal">✕</button>
          </div>

          <!-- Selected item info -->
          <div style="background:#f9fafb;padding:12px;border-radius:8px;margin-bottom:16px;font-size:0.875rem;">
            <strong>{{ sponsorModal.item?.name }}</strong>
            <div class="text-muted text-xs mt-1" v-if="sponsorModal.item?.artist">画师：{{ sponsorModal.item.artist }}</div>
            <div class="text-primary font-bold mt-1" v-if="sponsorModal.item?.price">¥{{ sponsorModal.item.price }}</div>
          </div>

          <div v-if="!sponsorModal.confirming">
            <p class="text-sm text-muted mb-3">请填写被赞助方信息（至少填写一项）：</p>
            <div class="form-group">
              <label class="form-label">被赞助方平台</label>
              <select v-model="sponsorForm.platform" class="form-input">
                <option value="">请选择</option>
                <option value="易次元">易次元</option>
                <option value="橙光">橙光</option>
                <option value="闪艺">闪艺</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">被赞助方平台 ID</label>
              <input v-model="sponsorForm.platform_id" type="text" class="form-input" placeholder="平台 ID" />
            </div>
            <div class="form-group">
              <label class="form-label">被赞助方 QQ</label>
              <input v-model="sponsorForm.qq" type="text" class="form-input" placeholder="QQ 号码" />
            </div>
            <div v-if="sponsorError" class="form-error mb-2">{{ sponsorError }}</div>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="closeSponsorModal">取消</button>
              <button class="btn btn-primary" @click="confirmSponsor">下一步</button>
            </div>
          </div>

          <div v-else>
            <p class="text-sm mb-3">请确认赞助信息：</p>
            <div style="background:#f9fafb;padding:12px;border-radius:8px;font-size:0.875rem;margin-bottom:16px;">
              <div><strong>素材：</strong>{{ sponsorModal.item?.name }}</div>
              <div v-if="sponsorForm.platform"><strong>平台：</strong>{{ sponsorForm.platform }}</div>
              <div v-if="sponsorForm.platform_id"><strong>平台 ID：</strong>{{ sponsorForm.platform_id }}</div>
              <div v-if="sponsorForm.qq"><strong>QQ：</strong>{{ sponsorForm.qq }}</div>
            </div>
            <div class="alert alert-warning">赞助后该素材将归属于对方，您无法撤销此操作。</div>
            <div v-if="sponsorError" class="form-error mb-2">{{ sponsorError }}</div>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="sponsorModal.confirming = false">返回</button>
              <button class="btn btn-primary" @click="submitSponsor" :disabled="sponsorLoading">
                {{ sponsorLoading ? '提交中...' : '确认赞助' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, inject, onMounted } from 'vue'
import { shopAPI, assetsAPI } from '@/api/index.js'
import Pagination from '@/components/Pagination.vue'

const addToast = inject('addToast')

const items = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const limit = ref(20)

const topics = ['立绘', '通加', '场景', 'CG', '素材', '美工', '音乐']
const filters = reactive({ topic: '', artist: '' })

const sponsorModal = reactive({ visible: false, item: null, confirming: false })
const sponsorForm = reactive({ platform: '', platform_id: '', qq: '' })
const sponsorError = ref('')
const sponsorLoading = ref(false)

async function loadItems(p = 1) {
  page.value = p
  loading.value = true
  try {
    const params = { page: p, limit: limit.value }
    if (filters.topic) params.topic = filters.topic
    if (filters.artist) params.artist = filters.artist
    const res = await shopAPI.getItems(params)
    items.value = res.data || res.items || []
    total.value = res.total || res.count || 0
  } catch (e) {
    addToast('加载商品失败', 'error')
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.topic = ''
  filters.artist = ''
  loadItems(1)
}

function getTags(item) {
  const t = item.tags
  if (!t) return []
  if (Array.isArray(t)) return t
  return t.split(',').map(s => s.trim()).filter(Boolean)
}

function openSponsorModal(item) {
  sponsorModal.item = item
  sponsorModal.visible = true
  sponsorModal.confirming = false
  sponsorForm.platform = ''
  sponsorForm.platform_id = ''
  sponsorForm.qq = ''
  sponsorError.value = ''
}

function closeSponsorModal() {
  sponsorModal.visible = false
  sponsorModal.confirming = false
}

function confirmSponsor() {
  if (!sponsorForm.platform && !sponsorForm.platform_id && !sponsorForm.qq) {
    sponsorError.value = '请至少填写一项被赞助方信息'
    return
  }
  sponsorError.value = ''
  sponsorModal.confirming = true
}

async function submitSponsor() {
  sponsorLoading.value = true
  sponsorError.value = ''
  try {
    const item = sponsorModal.item
    const data = {
      item_id: item._id || item.id,
    }
    if (sponsorForm.platform) data.target_platform = sponsorForm.platform
    if (sponsorForm.platform_id) data.target_platform_id = sponsorForm.platform_id
    if (sponsorForm.qq) data.target_qq = sponsorForm.qq
    const res = await assetsAPI.sponsor(data)
    if (res.message && !res.error) {
      addToast('赞助成功！', 'success')
      closeSponsorModal()
    } else {
      sponsorError.value = res.message || res.error || '赞助失败'
    }
  } catch (e) {
    sponsorError.value = '网络错误，请稍后重试'
  } finally {
    sponsorLoading.value = false
  }
}

onMounted(() => {
  loadItems(1)
})
</script>
