<template>
  <div :class="['activity-item', flowClass]">
    <div class="activity-icon" :style="{ background: iconBg }">
      {{ typeIcon }}
    </div>
    <div class="activity-content">
      <div class="activity-title">
        <span class="badge" :class="typeBadgeClass">{{ typeLabel }}</span>
        &nbsp;
        <span>{{ itemName }}</span>
      </div>
      <div class="activity-desc">
        <template v-if="transaction.target_id">
          对象用户：<strong>{{ targetName }}</strong>&nbsp;
        </template>
        <template v-if="transaction.delivery_url">
          <a :href="transaction.delivery_url" target="_blank" rel="noopener" class="text-primary">查看发货链接</a>
        </template>
      </div>
    </div>
    <div class="activity-right">
      <div :class="['activity-points', pointsClass]">
        {{ pointsDisplay }}
      </div>
      <div class="activity-time">{{ formatDate(transaction.created_at) }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  transaction: {
    type: Object,
    required: true
  }
})

const typeMap = {
  purchase_self: { label: '购买-自用', icon: '🛒', badge: 'badge-primary', flow: '' },
  purchase_sponsor: { label: '购买-赞助', icon: '🎁', badge: 'badge-warning', flow: 'outflow' },
  sponsored: { label: '被赞助', icon: '🎀', badge: 'badge-success', flow: 'inflow' },
  transfer_out: { label: '转出', icon: '📤', badge: 'badge-danger', flow: 'outflow' },
  transfer_in: { label: '转入', icon: '📥', badge: 'badge-success', flow: 'inflow' },
}

const txType = computed(() => props.transaction.transaction_type || props.transaction.type || '')
const typeMeta = computed(() => typeMap[txType.value] || { label: txType.value, icon: '📄', badge: 'badge-default', flow: '' })

const typeLabel = computed(() => typeMeta.value.label)
const typeIcon = computed(() => typeMeta.value.icon)
const typeBadgeClass = computed(() => typeMeta.value.badge)
const flowClass = computed(() => typeMeta.value.flow)

const iconBg = computed(() => {
  const flow = typeMeta.value.flow
  if (flow === 'outflow') return '#fee2e2'
  if (flow === 'inflow') return '#dcfce7'
  return '#ede9fe'
})

const itemName = computed(() => {
  const item = props.transaction.item_id
  if (!item) return '-'
  if (typeof item === 'object') return item.name || '-'
  return item
})

const targetName = computed(() => {
  const t = props.transaction.target_id
  if (!t) return ''
  if (typeof t === 'object') return t.username || t._id || ''
  return t
})

const points = computed(() => props.transaction.points_change ?? props.transaction.points ?? 0)

const pointsDisplay = computed(() => {
  if (points.value > 0) return `+${points.value.toLocaleString()}`
  if (points.value < 0) return points.value.toLocaleString()
  return '0'
})

const pointsClass = computed(() => {
  if (points.value > 0) return 'positive'
  if (points.value < 0) return 'negative'
  return 'neutral'
})

function formatDate(val) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>
