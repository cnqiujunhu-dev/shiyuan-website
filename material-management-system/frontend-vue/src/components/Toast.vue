<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`]"
      >
        <span class="toast-icon">
          <span v-if="toast.type === 'success'">✓</span>
          <span v-else-if="toast.type === 'error'">✕</span>
          <span v-else-if="toast.type === 'warning'">⚠</span>
          <span v-else>ℹ</span>
        </span>
        <span class="toast-msg">{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
defineProps({
  toasts: {
    type: Array,
    default: () => []
  }
})
</script>

<style scoped>
.toast-enter-active {
  animation: slideIn 0.25s ease-out;
}
.toast-leave-active {
  animation: slideOut 0.25s ease-in forwards;
}

@keyframes slideIn {
  from { transform: translateX(110%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(110%); opacity: 0; }
}

.toast-icon {
  font-size: 1rem;
  font-weight: 700;
  flex-shrink: 0;
}

.toast-msg {
  flex: 1;
}
</style>
