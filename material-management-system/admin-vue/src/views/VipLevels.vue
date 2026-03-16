<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">VIP 等级配置</div>
        <div class="page-subtitle">管理 VIP 等级门槛与权益设置</div>
      </div>
      <button class="btn btn-primary" @click="openCreate">➕ 新增等级</button>
    </div>

    <div class="page">
      <div class="table-container">
        <div v-if="loading" class="table-loading">加载中...</div>
        <div v-else-if="levels.length === 0" class="table-empty">暂无等级配置</div>
        <table v-else>
          <thead>
            <tr>
              <th>等级</th>
              <th>积分门槛</th>
              <th>回购次数/年</th>
              <th>转让次数/年</th>
              <th>免抢次数/年</th>
              <th>VIP 优先购</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lv in levels" :key="lv.id || lv.level">
              <td>
                <span class="vip-badge" :class="`vip${lv.level}`">VIP{{ lv.level }}</span>
              </td>
              <td>{{ lv.points_threshold ?? '-' }} 积分</td>
              <td>{{ lv.repurchase_per_year ?? '-' }} 次</td>
              <td>{{ lv.transfer_per_year ?? '-' }} 次</td>
              <td>{{ lv.free_grab_per_year ?? '-' }} 次</td>
              <td>
                <span v-if="lv.vip_priority" class="status-badge active">是</span>
                <span v-else class="status-badge inactive">否</span>
              </td>
              <td>
                <button class="btn btn-ghost btn-sm" @click="openEdit(lv)">编辑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="info-text mt-4">
        修改等级门槛不会立即影响现有 VIP 顾客，仅对后续积分升级计算生效。如需手动调整顾客等级请前往 VIP 顾客管理页面操作。
      </div>
    </div>

    <!-- Edit / Create Modal -->
    <div v-if="modal.show" class="modal-overlay" @click.self="modal.show = false">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">{{ modal.isEdit ? `编辑 VIP${modal.form.level} 配置` : '新增 VIP 等级' }}</span>
          <button class="modal-close" @click="modal.show = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="!modal.isEdit" class="form-group mb-3">
            <label class="form-label">等级编号 <span class="required">*</span></label>
            <input v-model.number="modal.form.level" type="number" min="1" max="10" class="form-input" />
            <span class="form-hint">如 6 代表 VIP6</span>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">积分门槛</label>
              <input v-model.number="modal.form.points_threshold" type="number" min="0" class="form-input" placeholder="0" />
            </div>
            <div class="form-group">
              <label class="form-label">回购次数/年</label>
              <input v-model.number="modal.form.repurchase_per_year" type="number" min="0" class="form-input" placeholder="0" />
            </div>
            <div class="form-group">
              <label class="form-label">转让次数/年</label>
              <input v-model.number="modal.form.transfer_per_year" type="number" min="0" class="form-input" placeholder="0" />
            </div>
            <div class="form-group">
              <label class="form-label">免抢次数/年</label>
              <input v-model.number="modal.form.free_grab_per_year" type="number" min="0" class="form-input" placeholder="0" />
            </div>
          </div>
          <div class="form-group mt-3">
            <label class="checkbox-item">
              <input type="checkbox" v-model="modal.form.vip_priority" />
              享有 VIP 优先购权益
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="modal.show = false">取消</button>
          <button class="btn btn-primary" :disabled="modal.loading" @click="submitModal">
            {{ modal.loading ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import { vipsAPI } from '../api/index.js'

const addToast = inject('addToast')
const levels = ref([])
const loading = ref(false)

const modal = ref({
  show: false,
  isEdit: false,
  loading: false,
  editId: null,
  form: {
    level: '',
    points_threshold: 0,
    repurchase_per_year: 0,
    transfer_per_year: 0,
    free_grab_per_year: 0,
    vip_priority: false
  }
})

async function loadLevels() {
  loading.value = true
  try {
    const res = await vipsAPI.getLevels()
    levels.value = res.levels || res.data || []
  } finally {
    loading.value = false
  }
}

function openEdit(lv) {
  modal.value = {
    show: true,
    isEdit: true,
    loading: false,
    editId: lv.id || lv.level,
    form: {
      level: lv.level,
      points_threshold: lv.points_threshold ?? 0,
      repurchase_per_year: lv.repurchase_per_year ?? 0,
      transfer_per_year: lv.transfer_per_year ?? 0,
      free_grab_per_year: lv.free_grab_per_year ?? 0,
      vip_priority: !!lv.vip_priority
    }
  }
}

function openCreate() {
  modal.value = {
    show: true,
    isEdit: false,
    loading: false,
    editId: null,
    form: {
      level: '',
      points_threshold: 0,
      repurchase_per_year: 0,
      transfer_per_year: 0,
      free_grab_per_year: 0,
      vip_priority: false
    }
  }
}

async function submitModal() {
  modal.value.loading = true
  try {
    const data = { ...modal.value.form }
    if (modal.value.isEdit) {
      await vipsAPI.updateLevel(modal.value.editId, data)
      addToast('success', '保存成功', `VIP${data.level} 配置已更新`)
    } else {
      await vipsAPI.createLevel(data)
      addToast('success', '创建成功', `VIP${data.level} 已添加`)
    }
    modal.value.show = false
    loadLevels()
  } catch (e) {
    addToast('error', '操作失败', e.message)
  } finally {
    modal.value.loading = false
  }
}

onMounted(loadLevels)
</script>
