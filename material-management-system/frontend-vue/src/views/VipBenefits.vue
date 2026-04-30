<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">VIP 权益</h1>
    </div>

    <!-- Current Status Card -->
    <div class="vip-level-card" :style="cardStyle" style="margin-bottom:24px;">
      <div class="vip-level-title" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <VipBadge :level="auth.vipLevel" />
        <span style="font-size:1.15rem;font-weight:700;">{{ currentLevelName }}</span>
      </div>

      <div class="vip-stats">
        <div class="vip-stat">
          <div class="vip-stat-label">累计积分</div>
          <div class="vip-stat-value">{{ (displayData.points_total || 0).toLocaleString() }}</div>
        </div>
        <div class="vip-stat">
          <div class="vip-stat-label">年度消费</div>
          <div class="vip-stat-value">¥{{ (displayData.annual_spend || 0).toLocaleString() }}</div>
        </div>
        <div class="vip-stat">
          <div class="vip-stat-label">剩余回购次数</div>
          <div class="vip-stat-value">{{ auth.vipLevel >= 1 ? (displayData.buyback_remaining ?? '-') : '-' }}</div>
        </div>
        <div class="vip-stat">
          <div class="vip-stat-label">剩余帮回购次数</div>
          <div class="vip-stat-value">{{ auth.vipLevel >= 1 ? (displayData.assisted_buyback_remaining ?? '-') : '-' }}</div>
        </div>
        <div class="vip-stat">
          <div class="vip-stat-label">剩余转让次数</div>
          <div class="vip-stat-value">{{ auth.vipLevel >= 2 ? (displayData.transfer_remaining ?? '-') : '-' }}</div>
        </div>
      </div>

      <!-- Progress Bar to Next Level -->
      <template v-if="nextLevel">
        <div style="margin-top:16px;">
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:6px;" :style="{ color: isMaxLevel ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }">
            <span>距下一等级 {{ nextLevelName }}</span>
            <span>{{ (displayData.points_total || 0).toLocaleString() }} / {{ nextLevel.threshold.toLocaleString() }} 积分</span>
          </div>
          <div style="height:8px;background:rgba(0,0,0,0.1);border-radius:999px;overflow:hidden;">
            <div
              :style="{
                height: '100%',
                width: progressPct + '%',
                borderRadius: '999px',
                background: isMaxLevel ? 'rgba(255,255,255,0.8)' : 'var(--primary)',
                transition: 'width 0.6s ease',
              }"
            ></div>
          </div>
        </div>
      </template>
      <div v-else-if="maxVipLevel > 0 && auth.vipLevel >= maxVipLevel" style="margin-top:12px;font-size:0.85rem;opacity:0.85;">
        已达最高等级，感谢您的支持！
      </div>
    </div>

    <!-- VIP Tiers Table -->
    <div class="card" style="margin-bottom:24px;overflow:hidden;">
      <div class="section-header" style="padding:16px 20px 12px;">
        <div class="section-title">VIP 等级权益对照表</div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
          <thead>
            <tr style="background:#f9fafb;border-bottom:2px solid var(--border);">
              <th style="padding:10px 16px;text-align:left;font-weight:600;white-space:nowrap;">等级</th>
              <th style="padding:10px 16px;text-align:left;font-weight:600;white-space:nowrap;">积分门槛</th>
              <th style="padding:10px 16px;text-align:left;font-weight:600;white-space:nowrap;">回购/年</th>
              <th style="padding:10px 16px;text-align:left;font-weight:600;white-space:nowrap;">帮回购/年</th>
              <th style="padding:10px 16px;text-align:left;font-weight:600;white-space:nowrap;">转让/年</th>
              <th style="padding:10px 16px;text-align:left;font-weight:600;white-space:nowrap;">VIP 优先购</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in vipTiers"
              :key="row.level"
              :style="{
                background: row.level === auth.vipLevel ? 'var(--primary-light, #ede9fe)' : '',
                fontWeight: row.level === auth.vipLevel ? '600' : '',
                borderBottom: '1px solid var(--border)',
              }"
            >
              <td style="padding:10px 16px;white-space:nowrap;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <VipBadge :level="row.level" />
                  <span v-if="row.level === auth.vipLevel" class="badge badge-primary" style="font-size:0.7rem;">当前</span>
                </div>
              </td>
              <td style="padding:10px 16px;white-space:nowrap;">{{ row.threshold.toLocaleString() }} 积分</td>
              <td style="padding:10px 16px;text-align:center;">{{ row.buyback }}</td>
              <td style="padding:10px 16px;text-align:center;">{{ row.assistedBuyback ?? row.assisted_buyback_per_year ?? row.buyback }}</td>
              <td style="padding:10px 16px;text-align:center;">{{ row.transfer === 0 ? '—' : row.transfer }}</td>
              <td style="padding:10px 16px;text-align:center;">
                <span v-if="row.priorityBuy" class="badge badge-success">优先购</span>
                <span v-else class="text-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Notes Section -->
    <div class="card">
      <div class="section-title" style="margin-bottom:14px;">说明</div>
      <ul style="padding-left:20px;color:var(--text-muted);font-size:0.875rem;line-height:2.2;">
        <li>VIP 等级依据累计积分达到对应门槛自动升级，积分由购买记录累积产生。</li>
        <li>每年年度权益（回购、帮回购、转让次数）于每年 1 月 1 日重置，未使用次数不可累计至下一年。</li>
        <li>只要年度消费不为 0，等级在年末不会降级。</li>
        <li>转让操作仅限 VIP2 及以上，转让后素材不可撤回，请谨慎操作。</li>
        <li>回购改为由管理员导入授权名单生效，不再走用户申请审核；回购和帮回购素材均不可转让。</li>
        <li>VIP 优先购为在正式开售前享有优先购买权，具体以公告为准。</li>
        <li>平台保留对 VIP 规则进行合理调整的权利，重大调整将提前公告。</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useUserStore } from '@/stores/user.js'
import { shopAPI } from '@/api/index.js'
import VipBadge from '@/components/VipBadge.vue'

const auth = useAuthStore()
const userStore = useUserStore()

const DEFAULT_VIP_TIERS = [
  { level: 1, threshold: 888, buyback: 3, assistedBuyback: 1, transfer: 0, priorityBuy: true },
  { level: 2, threshold: 2688, buyback: 5, assistedBuyback: 5, transfer: 5, priorityBuy: true },
  { level: 3, threshold: 5688, buyback: 8, assistedBuyback: 8, transfer: 10, priorityBuy: true },
]

const vipTiers = ref(DEFAULT_VIP_TIERS)

function formatLevelName(level) {
  if (level <= 0) return '普通会员'
  const aliases = {
    1: 'VIP1·铜牌',
    2: 'VIP2·银牌',
    3: 'VIP3·金牌'
  }
  return aliases[level] || `VIP${level}`
}

// Prefer userStore.summary for up-to-date data, fall back to auth.user
const displayData = computed(() => {
  const s = userStore.summary
  const u = auth.user
  return {
    points_total:       s?.points_total       ?? s?.total_points       ?? u?.points_total       ?? 0,
    annual_spend:       s?.annual_spend        ?? s?.annual_spending    ?? u?.annual_spend        ?? 0,
    buyback_remaining:  s?.buyback_remaining   ?? s?.repurchase_quota_remaining ?? u?.buyback_remaining  ?? null,
    assisted_buyback_remaining: s?.assisted_buyback_remaining ?? u?.assisted_buyback_remaining ?? null,
    transfer_remaining: s?.transfer_remaining  ?? s?.transfer_quota_remaining   ?? u?.transfer_remaining ?? null,
  }
})

const maxVipLevel = computed(() => vipTiers.value[vipTiers.value.length - 1]?.level || 0)
const currentLevelName = computed(() => formatLevelName(auth.vipLevel))
const nextLevelName = computed(() => formatLevelName(auth.vipLevel + 1))
const isMaxLevel = computed(() => maxVipLevel.value > 0 && auth.vipLevel >= maxVipLevel.value)

const nextLevel = computed(() => {
  return vipTiers.value.find(t => t.level === auth.vipLevel + 1) || null
})

const progressPct = computed(() => {
  if (!nextLevel.value) return 100
  const pts = displayData.value.points_total || 0
  const threshold = nextLevel.value.threshold
  const prevThreshold = auth.vipLevel > 0 ? (vipTiers.value.find(t => t.level === auth.vipLevel)?.threshold || 0) : 0
  const range = threshold - prevThreshold
  if (range <= 0) return 100
  const progress = pts - prevThreshold
  return Math.min(100, Math.max(0, Math.round((progress / range) * 100)))
})

const cardStyle = computed(() => {
  const gradients = [
    'linear-gradient(135deg, #f3f4f6, #fff)',
    'linear-gradient(135deg, #fef3c7, #fffbeb)',
    'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
    'linear-gradient(135deg, #fef9c3, #fef3c7)',
    'linear-gradient(135deg, #e0e7ff, #f3e8ff)',
    'linear-gradient(135deg, #0ea5e9 0%, #7c3aed 100%)',
  ]
  const borders = ['#e5e7eb', '#fbbf24', '#94a3b8', '#f59e0b', '#a78bfa', '#7c3aed']
  const paletteIndex = Math.min(auth.vipLevel, gradients.length - 1)
  return {
    background: gradients[paletteIndex] || gradients[0],
    borderColor: borders[paletteIndex] || borders[0],
    color: isMaxLevel.value ? '#fff' : undefined,
  }
})

async function loadVipTiers() {
  try {
    const res = await shopAPI.getVipLevels()
    if (Array.isArray(res.levels) && res.levels.length > 0) {
      vipTiers.value = res.levels
    }
  } catch {
    vipTiers.value = DEFAULT_VIP_TIERS
  }
}

onMounted(() => {
  userStore.fetchSummary()
  loadVipTiers()
})
</script>
