import { defineStore } from 'pinia'
import { meAPI } from '@/api/index.js'

function normalizeSummary(payload = {}) {
  return {
    ...payload,
    points_total: payload.points_total ?? payload.total_points ?? 0,
    total_points: payload.total_points ?? payload.points_total ?? 0,
    annual_spend: payload.annual_spend ?? payload.annual_spending ?? 0,
    annual_spending: payload.annual_spending ?? payload.annual_spend ?? 0,
    transfer_remaining: payload.transfer_remaining ?? payload.transfer_quota_remaining ?? 0,
    transfer_quota_remaining: payload.transfer_quota_remaining ?? payload.transfer_remaining ?? 0,
    buyback_remaining: payload.buyback_remaining ?? payload.repurchase_quota_remaining ?? 0,
    repurchase_quota_remaining: payload.repurchase_quota_remaining ?? payload.buyback_remaining ?? 0,
    assisted_buyback_remaining: payload.assisted_buyback_remaining ?? 0,
    skip_queue_remaining: payload.skip_queue_remaining ?? payload.free_grab_remaining ?? 0,
    free_grab_remaining: payload.free_grab_remaining ?? payload.skip_queue_remaining ?? 0,
  }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    summary: null,
    loading: false,
  }),
  actions: {
    async fetchSummary() {
      this.loading = true
      try {
        const res = await meAPI.getSummary()
        const payload = res.user || res
        if (payload && Object.keys(payload).length > 0) {
          this.summary = normalizeSummary(payload)
        }
      } finally {
        this.loading = false
      }
    }
  }
})
