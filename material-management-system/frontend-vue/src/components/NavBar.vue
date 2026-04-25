<template>
  <nav class="nav">
    <RouterLink to="/" class="nav-brand">📦 诸城叙梦</RouterLink>

    <div class="nav-links" v-if="auth.isLoggedIn">
      <RouterLink to="/my-assets" class="nav-link">我的素材</RouterLink>
      <RouterLink to="/profile" class="nav-link">个人信息</RouterLink>
      <RouterLink to="/activities" class="nav-link">账户动态</RouterLink>
      <RouterLink to="/shop" class="nav-link">店铺素材</RouterLink>
      <RouterLink to="/vip" class="nav-link">VIP 权益</RouterLink>
      <RouterLink to="/help" class="nav-link">我的帮助</RouterLink>
    </div>

    <div class="nav-right">
      <template v-if="auth.isLoggedIn">
        <div class="nav-user">
          <span>{{ auth.user?.username }}</span>
          <VipBadge :level="auth.vipLevel" />
        </div>
        <button class="nav-logout" @click="handleLogout">退出登录</button>
      </template>
      <template v-else>
        <RouterLink to="/login" class="nav-link">登录</RouterLink>
        <RouterLink to="/register" class="nav-link">注册</RouterLink>
      </template>
    </div>
  </nav>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth.js'
import { useRouter } from 'vue-router'
import VipBadge from '@/components/VipBadge.vue'

const auth = useAuthStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>
