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
        <span v-if="item.points != null">{{ item.points }} 积分</span>
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
        购买时间：{{ formatDate(ownership.created_at) }}
      </div>
    </div>

    <!-- Actions -->
    <div class="asset-actions">
      <!-- Delivery link -->
      <button
        v-if="ownership.delivery_url"
        class="btn btn-secondary btn-sm"
        @click="showDelivery = true"
      >查看发货链接</button>

      <!-- Transfer -->
      <button
        v-if="canTransfer"
        class="btn btn-primary btn-sm"
        @click="emit('transfer', ownership._id || ownership.id)"
      >转让</button>
    </div>
  </div>

  <!-- Delivery Modal -->
  <Teleport to="body">
    <div v-if="showDelivery" class="modal-overlay" @click.self="showDelivery = false">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">发货链接</span>
          <button class="modal-close" @click="showDelivery = false">✕</button>
        </div>
        <div style="word-break:break-all; padding: 12px; background:#f9fafb; border-radius:8px; font-size:0.9rem;">
          <a :href="ownership.delivery_url" target="_blank" rel="noopener">{{ ownership.delivery_url }}</a>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showDelivery = false">关闭</button>
          <a :href="ownership.delivery_url" target="_blank" rel="noopener" class="btn btn-primary">打开链接</a>
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

const emit = defineEmits(['transfer'])

const auth = useAuthStore()
const imgError = ref(false)
const showDelivery = ref(false)

const item = computed(() => props.ownership.item_id || {})

const tags = computed(() => {
  const t = item.value.tags
  if (!t) return []
  if (Array.isArray(t)) return t
  return t.split(',').map(s => s.trim()).filter(Boolean)
})

const acquisitionTypeMap = {
  self: '自用',
  transfer: '接转',
  sponsored: '被赞助',
  transfer_out: '已转出',
}

const acquisitionLabel = computed(() => {
  return acquisitionTypeMap[props.ownership.acquisition_type] || props.ownership.acquisition_type || '未知'
})

const acquisitionBadgeClass = computed(() => {
  const t = props.ownership.acquisition_type
  if (t === 'transfer_out') return 'badge-danger'
  if (t === 'sponsored') return 'badge-success'
  if (t === 'transfer') return 'badge-warning'
  return 'badge-default'
})

const canTransfer = computed(() => {
  return props.ownership.acquisition_type === 'self' && auth.isVip
})

function formatDate(val) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('zh-CN')
}
</script>
