<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">仪表盘</div>
        <div class="page-subtitle">诸城叙梦素材管理平台概览</div>
      </div>
      <button class="btn btn-secondary btn-sm" @click="loadHealth">
        刷新状态
      </button>
    </div>

    <div class="page">
      <!-- System Status -->
      <div class="card" style="padding:16px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:10px">
          <span v-if="health === null" class="text-muted">检测中...</span>
          <template v-else-if="health.status === 'ok'">
            <span class="status-dot"></span>
            <span style="font-size:13px;font-weight:600;color:#065f46">系统正常运行</span>
            <span class="text-muted text-sm" style="margin-left:8px">
              数据库连接正常 · 服务可用
            </span>
          </template>
          <template v-else>
            <span class="status-dot offline"></span>
            <span style="font-size:13px;font-weight:600;color:#991b1b">系统状态异常</span>
            <span class="text-muted text-sm" style="margin-left:8px">{{ health.message }}</span>
          </template>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon">🖼️</div>
          <div class="stat-label">素材商品</div>
          <div class="stat-value">--</div>
          <div class="stat-trend">前往商品列表查看</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-label">交易记录</div>
          <div class="stat-value">--</div>
          <div class="stat-trend">前往交易记录查看</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👑</div>
          <div class="stat-label">VIP 顾客</div>
          <div class="stat-value">--</div>
          <div class="stat-trend">前往 VIP 管理查看</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👤</div>
          <div class="stat-label">注册用户</div>
          <div class="stat-value">--</div>
          <div class="stat-trend">前往用户列表查看</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-label">待审核申请</div>
          <div class="stat-value">--</div>
          <div class="stat-trend">前往审核中心处理</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔄</div>
          <div class="stat-label">转让记录</div>
          <div class="stat-value">--</div>
          <div class="stat-trend">前往转让记录查看</div>
        </div>
      </div>

      <!-- Quick Links -->
      <div style="margin-bottom:16px">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;color:var(--text)">快捷入口</h3>
        <div class="quick-links">
          <RouterLink to="/items" class="quick-link-card">
            <div class="quick-link-icon">🖼️</div>
            <div class="quick-link-title">商品管理</div>
          </RouterLink>
          <RouterLink to="/items/new" class="quick-link-card">
            <div class="quick-link-icon">➕</div>
            <div class="quick-link-title">新增商品</div>
          </RouterLink>
          <RouterLink to="/transactions" class="quick-link-card">
            <div class="quick-link-icon">💰</div>
            <div class="quick-link-title">交易记录</div>
          </RouterLink>
          <RouterLink to="/transactions/import" class="quick-link-card">
            <div class="quick-link-icon">📥</div>
            <div class="quick-link-title">批量导入交易</div>
          </RouterLink>
          <RouterLink to="/vip/customers" class="quick-link-card">
            <div class="quick-link-icon">👑</div>
            <div class="quick-link-title">VIP 顾客</div>
          </RouterLink>
          <RouterLink to="/vip/levels" class="quick-link-card">
            <div class="quick-link-icon">⚙️</div>
            <div class="quick-link-title">VIP 等级配置</div>
          </RouterLink>
          <RouterLink to="/vip/import" class="quick-link-card">
            <div class="quick-link-icon">📤</div>
            <div class="quick-link-title">VIP 批量导入</div>
          </RouterLink>
          <RouterLink to="/users" class="quick-link-card">
            <div class="quick-link-icon">👤</div>
            <div class="quick-link-title">用户管理</div>
          </RouterLink>
          <RouterLink to="/applications" class="quick-link-card">
            <div class="quick-link-icon">📋</div>
            <div class="quick-link-title">审核中心</div>
          </RouterLink>
          <RouterLink to="/transfers" class="quick-link-card">
            <div class="quick-link-icon">🔄</div>
            <div class="quick-link-title">转让记录</div>
          </RouterLink>
        </div>
      </div>

      <!-- Info -->
      <div class="info-text">
        当前为管理后台，所有操作将直接影响平台数据，请谨慎操作。如需帮助，请联系系统管理员。
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { healthAPI } from '../api/index.js'

const health = ref(null)

async function loadHealth() {
  try {
    const res = await healthAPI.check()
    health.value = res
  } catch (e) {
    health.value = { status: 'error', message: '无法连接到服务器' }
  }
}

onMounted(() => {
  loadHealth()
})
</script>
