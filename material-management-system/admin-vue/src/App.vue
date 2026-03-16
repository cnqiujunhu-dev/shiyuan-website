<template>
  <RouterView />

  <!-- Global Toast Container -->
  <div class="toast-container">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="toast.type"
    >
      <span class="toast-icon">
        {{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠' : 'ℹ' }}
      </span>
      <div class="toast-content">
        <div class="toast-title">{{ toast.title }}</div>
        <div v-if="toast.message" class="toast-message">{{ toast.message }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'

const toasts = ref([])
let toastId = 0

function addToast(type, title, message = '', duration = 3000) {
  const id = ++toastId
  toasts.value.push({ id, type, title, message })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, duration)
}

provide('addToast', addToast)
</script>
