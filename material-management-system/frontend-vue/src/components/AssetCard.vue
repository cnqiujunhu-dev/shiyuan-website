<template>
  <div class="asset-item">
    <!-- Preview -->
    <div class="asset-preview">
      <img
        v-if="item.preview_url"
        :src="item.preview_url"
        :alt="item.name"
        @error="imgError = true"
      />
      <span v-if="!item.preview_url || imgError">🖼️</span>
    </div>

    <!-- Info -->
    <div class="asset-info">
      <div class="asset-name">{{ item.name || '未命名素材' }}</div>
      <div class="asset-meta">
        <span v-if="item.artist">画师：{{ item.artist }}</span>
        <span v-if="item.price != null">¥{{ item.price }}</span>
        <span v-if="ownership.points_delta">{{ ownership.points_delta }} 积分</span>
        <span class="badge" :class="acquisitionBadgeClass">{{ acquisitionLabel }}</span>
      </div>
      <div class="asset-tags" v-if="tags.length">
        <span
          v-for="tag in tags"
          :key="tag"
          class="badge badge-primary"
        >{{ tag }}</span>
      </div>
      <div class="text-xs text-muted">
        获取时间：{{ formatDate(ownership.occurred_at || ownership.created_at) }}
      </div>
    </div>

    <!-- Actions -->
    <div class="asset-actions">
      <!-- 自用: 下载 + 转让 -->
      <template v-if="ownership.acquisition_type === 'self'">
        <button
          v-if="deliveryUrl"
          class="btn btn-secondary btn-sm"
          @click="showDelivery = true"
        >下载</button>
        <button
          v-if="canTransfer"
          class="btn btn-primary btn-sm"
          @click="emit('transfer', ownership._id || ownership.id)"
        >转让</button>
        <span v-if="!canTransfer && auth.vipLevel < 2" class="text-xs text-muted" style="display:block;max-width:100px;">VIP2 以上可转让</span>
      </template>

      <!-- 已赞助: 查看被赞助方 -->
      <template v-if="ownership.acquisition_type === 'sponsor'">
        <button
          class="btn btn-secondary btn-sm"
          @click="showSponsorInfo = true"
        >查看</button>
      </template>

      <!-- 被赞助: 查看赞助方 + 下载 -->
      <template v-if="ownership.acquisition_type === 'sponsored'">
        <button
          class="btn btn-secondary btn-sm"
          @click="showSponsorInfo = true"
        >查看</button>
        <button
          v-if="deliveryUrl"
          class="btn btn-primary btn-sm"
          @click="showDelivery = true"
        >下载</button>
      </template>

      <!-- 赞助待定: 登记 -->
      <template v-if="ownership.acquisition_type === 'sponsor_pending'">
        <button
          class="btn btn-primary btn-sm"
          @click="emit('register', ownership._id || ownership.id)"
        >登记</button>
      </template>
    </div>
  </div>

  <!-- Delivery Modal -->
  <Teleport to="body">
    <div v-if="showDelivery" class="modal-overlay" @click.self="showDelivery = false">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">下载链接</span>
          <button class="modal-close" @click="showDelivery = false">✕</button>
        </div>
        <div style="word-break:break-all; padding: 12px; background:#f9fafb; border-radius:8px; font-size:0.9rem;">
          <a :href="deliveryUrl" target="_blank" rel="noopener">{{ deliveryUrl }}</a>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showDelivery = false">关闭</button>
          <a :href="deliveryUrl" target="_blank" rel="noopener" class="btn btn-primary">打开链接</a>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Sponsor Info Modal -->
  <Teleport to="body">
    <div v-if="showSponsorInfo" class="modal-overlay" @click.self="showSponsorInfo = false">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">{{ ownership.acquisition_type === 'sponsor' ? '被赞助方信息' : '赞助方信息' }}</span>
          <button class="modal-close" @click="showSponsorInfo = false">✕</button>
        </div>
        <div style="padding: 12px; background:#f9fafb; border-radius:8px; font-size:0.9rem;">
          <template v-if="ownership.acquisition_type === 'sponsor' && ownership.target_user_id">
            <div v-if="ownership.target_user_id.platform_id">ID：{{ ownership.target_user_id.platform_id }}</div>
            <div v-if="ownership.target_user_id.qq">QQ：{{ ownership.target_user_id.qq }}</div>
            <div v-if="!ownership.target_user_id.platform_id && !ownership.target_user_id.qq">{{ ownership.target_user_id.username || '未知' }}</div>
          </template>
          <template v-else-if="ownership.acquisition_type === 'sponsored' && ownership.source_user_id">
            <div v-if="ownership.source_user_id.platform_id">ID：{{ ownership.source_user_id.platform_id }}</div>
            <div v-if="ownership.source_user_id.qq">QQ：{{ ownership.source_user_id.qq }}</div>
            <div v-if="!ownership.source_user_id.platform_id && !ownership.source_user_id.qq">{{ ownership.source_user_id.username || '未知' }}</div>
          </template>
          <div v-else class="text-muted">暂无信息</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showSponsorInfo = false">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.js'

const props = defineProps({
  ownership: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['transfer', 'register'])

const auth = useAuthStore()
const imgError = ref(false)
const showDelivery = ref(false)
const showSponsorInfo = ref(false)

const item = computed(() => props.ownership.item_id || {})

const tags = computed(() => {
  const t = item.value.topics || item.value.tags || item.value.categories
  if (!t) return []
  if (Array.isArray(t)) return t
  return t.split(',').map(s => s.trim()).filter(Boolean)
})

const deliveryUrl = computed(() => {
  return props.ownership.delivery_link || props.ownership.delivery_url || item.value.delivery_link
})

const acquisitionTypeMap = {
  self: '自用',
  sponsor: '已赞助',
  sponsored: '被赞助',
  sponsor_pending: '赞助待定',
  transfer_in: '转入',
}

const acquisitionLabel = computed(() => {
  return acquisitionTypeMap[props.ownership.acquisition_type] || props.ownership.acquisition_type || '未知'
})

const acquisitionBadgeClass = computed(() => {
  const t = props.ownership.acquisition_type
  if (t === 'sponsor') return 'badge-warning'
  if (t === 'sponsored') return 'badge-success'
  if (t === 'sponsor_pending') return 'badge-default'
  if (t === 'self') return 'badge-primary'
  return 'badge-default'
})

const canTransfer = computed(() => {
  return props.ownership.acquisition_type === 'self' && auth.vipLevel >= 2
})

function formatDate(val) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('zh-CN')
}
</script>
