<template>
  <RouterView />
  <Toast :toasts="toasts" />
</template>

<script setup>
import { ref, provide } from 'vue'
import Toast from '@/components/Toast.vue'

const toasts = ref([])
let nextId = 0

function addToast(message, type = 'info', duration = 3000) {
  const id = ++nextId
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    removeToast(id)
  }, duration)
}

function removeToast(id) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1) toasts.value.splice(idx, 1)
}

provide('addToast', addToast)
</script>
