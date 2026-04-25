<template>
  <div class="admin-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-title">🌸 诸城叙梦</div>
        <div class="sidebar-brand-sub">素材管理平台</div>
      </div>

      <nav class="sidebar-nav">
        <!-- 概览 -->
        <div class="sidebar-group">
          <div class="sidebar-group-label">概览</div>
          <RouterLink to="/dashboard" class="sidebar-item" :class="{ active: isActive('/dashboard') }">
            <span class="icon">📊</span>
            <span>仪表盘</span>
          </RouterLink>
        </div>

        <!-- 素材管理 -->
        <div class="sidebar-group">
          <div class="sidebar-group-label">素材管理</div>
          <RouterLink to="/items" class="sidebar-item" :class="{ active: isActive('/items') && !isActive('/items/new') }">
            <span class="icon">🖼️</span>
            <span>店铺素材</span>
          </RouterLink>
          <RouterLink to="/items/new" class="sidebar-item" :class="{ active: isActive('/items/new') }">
            <span class="icon">➕</span>
            <span>新增素材</span>
          </RouterLink>
        </div>

        <!-- 交易管理 -->
        <div class="sidebar-group">
          <div class="sidebar-group-label">交易管理</div>
          <RouterLink to="/transactions" class="sidebar-item" :class="{ active: isActive('/transactions') && !isActive('/transactions/import') }">
            <span class="icon">💰</span>
            <span>交易记录</span>
          </RouterLink>
          <RouterLink to="/transactions/import" class="sidebar-item" :class="{ active: isActive('/transactions/import') }">
            <span class="icon">📥</span>
            <span>批量导入</span>
          </RouterLink>
        </div>

        <!-- VIP 管理 -->
        <div class="sidebar-group">
          <div class="sidebar-group-label">VIP 管理</div>
          <RouterLink to="/vip/customers" class="sidebar-item" :class="{ active: isActive('/vip/customers') }">
            <span class="icon">👑</span>
            <span>VIP 顾客</span>
          </RouterLink>
          <RouterLink to="/vip/levels" class="sidebar-item" :class="{ active: isActive('/vip/levels') }">
            <span class="icon">⚙️</span>
            <span>等级配置</span>
          </RouterLink>
          <RouterLink to="/vip/import" class="sidebar-item" :class="{ active: isActive('/vip/import') }">
            <span class="icon">📤</span>
            <span>VIP 导入</span>
          </RouterLink>
        </div>

        <!-- 用户管理 -->
        <div class="sidebar-group">
          <div class="sidebar-group-label">用户管理</div>
          <RouterLink to="/users" class="sidebar-item" :class="{ active: isActive('/users') }">
            <span class="icon">👤</span>
            <span>用户列表</span>
          </RouterLink>
        </div>

        <!-- 运营 -->
        <div class="sidebar-group">
          <div class="sidebar-group-label">运营</div>
          <RouterLink to="/applications" class="sidebar-item" :class="{ active: isActive('/applications') }">
            <span class="icon">📋</span>
            <span>审核中心</span>
          </RouterLink>
          <RouterLink to="/transfers" class="sidebar-item" :class="{ active: isActive('/transfers') }">
            <span class="icon">🔄</span>
            <span>转让记录</span>
          </RouterLink>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-avatar">{{ userInitial }}</div>
          <span class="sidebar-username">{{ auth.user?.username || '管理员' }}</span>
        </div>
        <button class="btn btn-secondary btn-sm" style="width:100%" @click="handleLogout">
          退出登录
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const userInitial = computed(() => {
  const name = auth.user?.username || 'A'
  return name.charAt(0).toUpperCase()
})

function isActive(path) {
  if (path === '/dashboard') {
    return route.path === '/dashboard'
  }
  return route.path.startsWith(path)
}

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>
