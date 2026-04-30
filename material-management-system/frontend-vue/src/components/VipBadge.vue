<template>
  <span :class="['vip-badge', `vip-badge-${level}`]">
    <span>{{ icon }}</span>
    <span>{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  level: {
    type: Number,
    default: 0
  }
})

const levels = [
  { label: '普通', icon: '' },
  { label: 'VIP1·铜', icon: '🥉' },
  { label: 'VIP2·银', icon: '🥈' },
  { label: 'VIP3·金', icon: '🥇' },
]

const label = computed(() => levels[props.level]?.label ?? '普通')
const icon = computed(() => levels[props.level]?.icon ?? '')
</script>
