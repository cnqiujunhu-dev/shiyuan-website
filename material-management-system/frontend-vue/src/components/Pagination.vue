<template>
  <div class="pagination" v-if="totalPages > 1">
    <button
      class="page-btn"
      :disabled="page <= 1"
      @click="emit('change', page - 1)"
    >‹</button>

    <template v-for="p in pageList" :key="p">
      <span v-if="p === '...'" class="page-btn" style="cursor:default;border:none;">…</span>
      <button
        v-else
        :class="['page-btn', { active: p === page }]"
        @click="emit('change', p)"
      >{{ p }}</button>
    </template>

    <button
      class="page-btn"
      :disabled="page >= totalPages"
      @click="emit('change', page + 1)"
    >›</button>

    <span class="text-muted text-sm" style="margin-left:8px;">
      共 {{ total }} 条
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  total: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  limit: { type: Number, default: 20 },
})

const emit = defineEmits(['change'])

const totalPages = computed(() => Math.ceil(props.total / props.limit))

const pageList = computed(() => {
  const total = totalPages.value
  const cur = props.page
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = []
  pages.push(1)
  if (cur > 3) pages.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
    pages.push(i)
  }
  if (cur < total - 2) pages.push('...')
  pages.push(total)
  return pages
})
</script>
