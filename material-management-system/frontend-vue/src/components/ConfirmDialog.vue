<template>
  <Teleport to="body">
    <div v-if="visible" class="confirm-overlay" @click.self="emit('cancel')">
      <div class="confirm-dialog">
        <div class="confirm-title">{{ title }}</div>
        <div class="confirm-message" v-html="message"></div>
        <div class="confirm-actions">
          <button class="btn btn-ghost" @click="emit('cancel')">取消</button>
          <button class="btn btn-danger" @click="emit('confirm')">确认</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '确定要执行此操作吗？' },
})

const emit = defineEmits(['confirm', 'cancel'])
</script>
