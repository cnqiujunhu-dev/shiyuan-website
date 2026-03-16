<template>
  <div>
    <NavBar />

    <!-- Welcome Bar -->
    <div class="welcome-bar">
      <div>
        <div class="welcome-text">欢迎回来 · {{ auth.user?.username }}</div>
        <div class="welcome-sub" v-if="!auth.user?.email">
          ⚠️ 您尚未绑定邮箱，绑定后可用于找回密码
          <RouterLink to="/help" style="color:#c4b5fd;margin-left:8px;">去绑定</RouterLink>
        </div>
        <div class="welcome-sub" v-else>
          邮箱：{{ auth.user.email }}
        </div>
      </div>
      <VipBadge :level="auth.vipLevel" />
    </div>

    <!-- Page Content -->
    <RouterView />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useUserStore } from '@/stores/user.js'
import NavBar from '@/components/NavBar.vue'
import VipBadge from '@/components/VipBadge.vue'

const auth = useAuthStore()
const userStore = useUserStore()

onMounted(() => {
  userStore.fetchSummary()
})
</script>
