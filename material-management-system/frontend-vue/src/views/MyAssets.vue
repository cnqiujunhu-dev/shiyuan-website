<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">我的素材</h1>
    </div>

    <!-- User Info Bar -->
    <div class="info-grid" v-if="userStore.summary">
      <div class="info-card">
        <div class="info-card-label">当前平台</div>
        <div class="info-card-value">{{ userStore.summary.platform || '-' }}</div>
        <div class="info-card-sub">平台 ID：{{ userStore.summary.platform_id || '未设置' }}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">累计积分</div>
        <div class="info-card-value text-primary">{{ (userStore.summary.total_points || 0).toLocaleString() }}</div>
      </div>
      <div class="info-card" v-if="auth.vipLevel >= 2">
        <div class="info-card-label">剩余转让次数</div>
        <div class="info-card-value">{{ userStore.summary.transfer_quota_remaining ?? '-' }}</div>
        <div class="info-card-sub">年度配额</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">素材总数</div>
        <div class="info-card-value">{{ total }}</div>
      </div>
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
        @keyup.enter="loadAssets(1)"
      />
      <select v-model="filters.acquisition_type" class="form-input" style="min-width:120px;">
        <option value="">全部类型</option>
        <option value="self">自用</option>
        <option value="transfer">接转</option>
        <option value="sponsored">被赞助</option>
      </select>
      <button class="btn btn-primary btn-sm" @click="loadAssets(1)">筛选</button>
      <button class="btn btn-ghost btn-sm" @click="resetFilters">重置</button>
    </div>

    <!-- Loading -->
    <div class="loading-wrap" v-if="loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-else-if="!loading && assets.length === 0">
      <div class="empty-state-icon">📦</div>
      <div class="empty-state-title">暂无素材</div>
      <div class="empty-state-desc">您还没有购买任何素材，前往店铺浏览吧</div>
    </div>

    <!-- Asset List -->
    <div class="asset-list" v-else>
      <AssetCard
        v-for="item in assets"
        :key="item._id || item.id"
        :ownership="item"
        @transfer="openTransferModal"
      />
    </div>

    <!-- Pagination -->
    <Pagination :total="total" :page="page" :limit="limit" @change="loadAssets" />

    <!-- Transfer Modal -->
    <Teleport to="body">
      <div v-if="transferModal.visible" class="modal-overlay" @click.self="closeTransferModal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">转让素材</span>
            <button class="modal-close" @click="closeTransferModal">✕</button>
          </div>

          <div class="alert alert-warning" style="margin-bottom:16px;">
            ⚠️ 转让后不可撤销，素材将从您的账户移出，请谨慎操作！
          </div>

          <div v-if="!transferModal.confirming">
            <p class="text-sm text-muted mb-3">请填写接转方信息（至少填写一项）：</p>
            <div class="form-group">
              <label class="form-label">接转方平台</label>
              <select v-model="transferForm.platform" class="form-input">
                <option value="">请选择</option>
                <option value="易次元">易次元</option>
                <option value="橙光">橙光</option>
                <option value="闪艺">闪艺</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">接转方平台 ID</label>
              <input v-model="transferForm.platform_id" type="text" class="form-input" placeholder="平台 ID" />
            </div>
            <div class="form-group">
              <label class="form-label">接转方 QQ</label>
              <input v-model="transferForm.qq" type="text" class="form-input" placeholder="QQ 号码" />
            </div>
            <div v-if="transferError" class="form-error mb-2">{{ transferError }}</div>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="closeTransferModal">取消</button>
              <button class="btn btn-primary" @click="confirmTransfer">下一步</button>
            </div>
          </div>

          <div v-else>
            <p class="text-sm mb-3">请确认转让信息：</p>
            <div style="background:#f9fafb;padding:12px;border-radius:8px;font-size:0.875rem;margin-bottom:16px;">
              <div v-if="transferForm.platform">平台：{{ transferForm.platform }}</div>
              <div v-if="transferForm.platform_id">平台 ID：{{ transferForm.platform_id }}</div>
              <div v-if="transferForm.qq">QQ：{{ transferForm.qq }}</div>
            </div>
            <p class="text-sm text-danger font-bold">此操作不可撤销，确认后素材将立即转出。</p>
            <div v-if="transferError" class="form-error mb-2">{{ transferError }}</div>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="transferModal.confirming = false">返回</button>
              <button class="btn btn-danger" @click="submitTransfer" :disabled="transferLoading">
                {{ transferLoading ? '转让中...' : '确认转让' }}
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
import { useAuthStore } from '@/stores/auth.js'
import { useUserStore } from '@/stores/user.js'
import { assetsAPI } from '@/api/index.js'
import AssetCard from '@/components/AssetCard.vue'
import Pagination from '@/components/Pagination.vue'

const auth = useAuthStore()
const userStore = useUserStore()
const addToast = inject('addToast')

const assets = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const limit = ref(20)

const topics = ['立绘', '通加', '场景', 'CG', '素材', '美工', '音乐']
const filters = reactive({ topic: '', artist: '', acquisition_type: '' })

const transferModal = reactive({ visible: false, ownershipId: null, confirming: false })
const transferForm = reactive({ platform: '', platform_id: '', qq: '' })
const transferError = ref('')
const transferLoading = ref(false)

async function loadAssets(p = 1) {
  page.value = p
  loading.value = true
  try {
    const params = { page: p, limit: limit.value }
    if (filters.topic) params.topic = filters.topic
    if (filters.artist) params.artist = filters.artist
    if (filters.acquisition_type) params.acquisition_type = filters.acquisition_type
    const res = await assetsAPI.getMyAssets(params)
    assets.value = res.data || res.ownerships || res.items || []
    total.value = res.total || res.count || 0
  } catch (e) {
    addToast('加载素材失败', 'error')
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.topic = ''
  filters.artist = ''
  filters.acquisition_type = ''
  loadAssets(1)
}

function openTransferModal(ownershipId) {
  transferModal.ownershipId = ownershipId
  transferModal.visible = true
  transferModal.confirming = false
  transferForm.platform = ''
  transferForm.platform_id = ''
  transferForm.qq = ''
  transferError.value = ''
}

function closeTransferModal() {
  transferModal.visible = false
  transferModal.confirming = false
}

function confirmTransfer() {
  if (!transferForm.platform && !transferForm.platform_id && !transferForm.qq) {
    transferError.value = '请至少填写一项接转方信息'
    return
  }
  transferError.value = ''
  transferModal.confirming = true
}

async function submitTransfer() {
  transferLoading.value = true
  transferError.value = ''
  try {
    const data = { ownership_id: transferModal.ownershipId }
    if (transferForm.platform) data.target_platform = transferForm.platform
    if (transferForm.platform_id) data.target_platform_id = transferForm.platform_id
    if (transferForm.qq) data.target_qq = transferForm.qq
    const res = await assetsAPI.transfer(data)
    if (res.message && !res.error) {
      addToast('转让成功！', 'success')
      closeTransferModal()
      loadAssets(page.value)
      userStore.fetchSummary()
    } else {
      transferError.value = res.message || res.error || '转让失败'
    }
  } catch (e) {
    transferError.value = '网络错误，请稍后重试'
  } finally {
    transferLoading.value = false
  }
}

onMounted(() => {
  loadAssets(1)
})
</script>
