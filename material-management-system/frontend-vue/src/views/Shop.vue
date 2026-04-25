<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">店铺素材</h1>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <select v-model="filters.topic" class="form-input" style="min-width:120px;">
        <option value="">全部题材</option>
        <option v-for="t in topics" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="filters.status" class="form-input" style="min-width:100px;">
        <option value="">全部状态</option>
        <option value="on_sale">在售</option>
        <option value="completed">结车</option>
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
      <div class="empty-state-title">暂无素材</div>
      <div class="empty-state-desc">店铺暂时没有素材，请稍后再来</div>
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
          <!-- SKU Code -->
          <div class="text-xs text-muted" v-if="item.sku_code" style="margin-bottom:4px;">
            SKU：{{ item.sku_code }}
          </div>
          <div class="shop-card-name" :title="item.name">{{ item.name }}</div>
          <div class="shop-card-meta">
            <span v-if="item.artist">画师：{{ item.artist }}</span>
          </div>
          <div class="shop-card-price" style="display:flex;align-items:center;gap:8px;">
            <span v-if="item.price">¥{{ item.price }}</span>
            <span v-else class="text-muted text-sm">价格面议</span>
            <!-- Status Badge -->
            <span
              :class="['badge', item.status === 'completed' ? 'badge-default' : 'badge-success']"
              style="font-size:0.72rem;"
            >{{ statusLabel(item.status) }}</span>
          </div>
          <!-- 优先购标记 -->
          <div v-if="item.priority_only" class="badge badge-warning" style="margin-bottom:6px;font-size:0.72rem;">VIP 优先购</div>
          <!-- 排队限购标记 -->
          <div v-if="item.queue_enabled" class="badge badge-default" style="margin-bottom:6px;font-size:0.72rem;">限量排队</div>

          <!-- 自购按钮（普通商品） -->
          <button
            v-if="!item.queue_enabled"
            class="btn btn-primary btn-sm"
            style="width:100%;margin-bottom:6px;"
            :disabled="item.priority_only && auth.vipLevel < 1"
            @click="doBuyItem(item)"
          >
            <span v-if="item.priority_only && auth.vipLevel < 1">VIP 专属</span>
            <span v-else>立即购买</span>
          </button>

          <!-- 插队购买按钮（限购商品） -->
          <button
            v-if="item.queue_enabled"
            class="btn btn-primary btn-sm"
            style="width:100%;margin-bottom:6px;"
            :disabled="auth.vipLevel < 4 || skipQueueRemaining <= 0"
            @click="doBuyItem(item, true)"
          >
            <span v-if="auth.vipLevel < 4">需 VIP4+</span>
            <span v-else-if="skipQueueRemaining > 0">插队购买（剩余 {{ skipQueueRemaining }} 次）</span>
            <span v-else>插队次数已用完</span>
          </button>

          <button
            class="btn btn-secondary btn-sm"
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
            <p class="text-sm text-muted mb-3">请填写被赞助方信息（留空则创建赞助待定）：</p>
            <div class="form-group">
              <label class="form-label">被赞助方 ID</label>
              <input v-model="sponsorForm.target_id" type="text" class="form-input" placeholder="用户 ID（可选）" />
            </div>
            <div class="form-group">
              <label class="form-label">被赞助方 QQ</label>
              <input v-model="sponsorForm.target_qq" type="text" class="form-input" placeholder="QQ 号码（可选）" />
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
              <div v-if="sponsorForm.target_id"><strong>ID：</strong>{{ sponsorForm.target_id }}</div>
              <div v-if="sponsorForm.target_qq"><strong>QQ：</strong>{{ sponsorForm.target_qq }}</div>
              <div v-if="!sponsorForm.target_id && !sponsorForm.target_qq" class="text-muted">未指定接收方（赞助待定）</div>
            </div>
            <div class="alert alert-warning">赞助后您将获得积分，素材将归属于对方。</div>
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
import { ref, reactive, inject, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useUserStore } from '@/stores/user.js'
import { shopAPI, assetsAPI } from '@/api/index.js'
import Pagination from '@/components/Pagination.vue'

const auth = useAuthStore()
const userStore = useUserStore()

const addToast = inject('addToast')

const items = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const limit = ref(20)

const topics = ['立绘', 'CG', '场景', '通加', 'UI', '打光', '空境', '徽章', '封面']
const filters = reactive({ topic: '', artist: '', status: '' })

const sponsorModal = reactive({ visible: false, item: null, confirming: false })
const sponsorForm = reactive({ target_id: '', target_qq: '' })
const sponsorError = ref('')
const sponsorLoading = ref(false)
const skipQueueRemaining = computed(() => (
  userStore.summary?.skip_queue_remaining ??
  auth.user?.skip_queue_remaining ??
  0
))

function statusLabel(status) {
  if (status === 'completed') return '结车'
  if (status === 'on_sale') return '在售'
  return status || '在售'
}

async function loadItems(p = 1) {
  page.value = p
  loading.value = true
  try {
    const params = { page: p, limit: limit.value }
    if (filters.topic) params.topic = filters.topic
    if (filters.status) params.status = filters.status
    if (filters.artist) params.artist = filters.artist
    const res = await shopAPI.getItems(params)
    items.value = res.data || res.items || []
    total.value = res.total || res.count || 0
  } catch (e) {
    addToast('加载素材失败', 'error')
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.topic = ''
  filters.status = ''
  filters.artist = ''
  loadItems(1)
}

async function doBuyItem(item, isSkipQueue = false) {
  try {
    const res = isSkipQueue
      ? await shopAPI.skipQueueBuy(item._id || item.id)
      : await shopAPI.buyItem(item._id || item.id)
    if (res.message && !res.error) {
      if (auth.isLoggedIn) {
        await userStore.fetchSummary()
      }
      addToast(res.message, 'success')
      loadItems(page.value)
    } else {
      addToast(res.message || '购买失败', 'error')
    }
  } catch (e) {
    addToast(e?.message || '购买失败，请稍后重试', 'error')
  }
}

function openSponsorModal(item) {
  sponsorModal.item = item
  sponsorModal.visible = true
  sponsorModal.confirming = false
  sponsorForm.target_id = ''
  sponsorForm.target_qq = ''
  sponsorError.value = ''
}

function closeSponsorModal() {
  sponsorModal.visible = false
  sponsorModal.confirming = false
}

function confirmSponsor() {
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
    if (sponsorForm.target_id) data.target_id = sponsorForm.target_id
    if (sponsorForm.target_qq) data.target_qq = sponsorForm.target_qq
    const res = await assetsAPI.sponsor(data)
    if (res.message && !res.error) {
      if (auth.isLoggedIn) {
        await userStore.fetchSummary()
      }
      addToast(res.message, 'success')
      closeSponsorModal()
    } else {
      sponsorError.value = res.message || res.error || '赞助失败'
    }
  } catch (e) {
    sponsorError.value = e?.message || '赞助失败，请稍后重试'
  } finally {
    sponsorLoading.value = false
  }
}

onMounted(() => {
  if (auth.isLoggedIn) {
    userStore.fetchSummary()
  }
  loadItems(1)
})
</script>
