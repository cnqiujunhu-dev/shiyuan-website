import { defineStore } from 'pinia'
import { meAPI } from '@/api/index.js'

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
        if (res.user) this.summary = res.user
      } finally {
        this.loading = false
      }
    }
  }
})
