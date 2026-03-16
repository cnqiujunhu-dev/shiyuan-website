<template>
  <div class="page">
    <!-- Toast -->
    <div class="toast-container">
      <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">
        <span class="toast-icon">{{ t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '!' }}</span>
        <div class="toast-content"><div class="toast-title">{{ t.message }}</div></div>
      </div>
    </div>

    <div class="page-header">
      <div>
        <h1 class="page-title">批量导入交易</h1>
        <p class="page-subtitle">通过 JSON 格式批量录入交易记录</p>
      </div>
      <router-link to="/transactions" class="btn btn-secondary">← 返回记录</router-link>
    </div>

    <div class="import-zone">
      <!-- Format description -->
      <div class="import-desc">
        <div class="import-desc-title">格式说明</div>
        <p style="margin:8px 0;">请将交易记录整理为 JSON 数组格式，每条记录支持以下字段：</p>
        <ul style="margin:8px 0 12px 16px;font-size:13px;line-height:2;">
          <li><code>type</code> — 交易类型：<code>purchase_self</code>（自购）/ <code>purchase_sponsor</code>（赞助）/ <code>sponsored</code>（被赞助）/ <code>transfer_out</code>（转出）/ <code>transfer_in</code>（转入）（必填）</li>
          <li><code>actor_qq</code> — 操作方 QQ 号（必填）</li>
          <li><code>item_name</code> — 素材名称（必填，需与系统中已有商品匹配）</li>
          <li><code>price</code> — 交易价格，单位积分（必填）</li>
          <li><code>occurred_at</code> — 交易日期，格式 <code>YYYY-MM-DD</code>（必填）</li>
          <li><code>target_qq</code> — 目标方 QQ（赞助/转让类型必填）</li>
        </ul>
        <div class="code-block">{{ exampleJSON }}</div>
      </div>

      <!-- Import rules -->
      <div class="info-text" style="margin:16px 0;">
        <strong>导入规则：</strong>操作方/目标方需已在系统中注册（通过 QQ 匹配）。素材名称需与系统中现有商品精确匹配。重复导入同一条记录不会自动去重，请确保数据无重复。
      </div>

      <!-- Textarea -->
      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label">JSON 数据</label>
        <textarea
          v-model="jsonText"
          class="form-textarea"
          style="min-height:280px;font-family:'Courier New',monospace;font-size:12px;"
          placeholder="请粘贴 JSON 数组格式的交易记录..."
        ></textarea>
      </div>

      <!-- Validate status -->
      <div v-if="validateStatus" class="import-result" :class="validateStatus.type" style="margin-bottom:16px;">
        <div class="import-result-title">{{ validateStatus.message }}</div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn btn-secondary" @click="validate">验证格式</button>
        <button class="btn btn-primary" :disabled="importing || !isValid" @click="handleImport">
          {{ importing ? '导入中...' : '确认导入' }}
        </button>
        <button class="btn btn-ghost" @click="fillExample">填入示例</button>
        <button class="btn btn-ghost" style="color:#ef4444;" @click="clearAll">清空</button>
      </div>

      <!-- Import result -->
      <div v-if="importResult" class="import-result" :class="importResult.type">
        <div class="import-result-title">{{ importResult.title }}</div>
        <div v-if="importResult.message" style="font-size:13px;margin-top:6px;opacity:0.85;">{{ importResult.message }}</div>
        <ul v-if="importResult.errors && importResult.errors.length > 0" class="error-list" style="margin-top:8px;">
          <li v-for="(err, i) in importResult.errors.slice(0, 20)" :key="i">{{ err }}</li>
          <li v-if="importResult.errors.length > 20" style="opacity:0.7;">...还有 {{ importResult.errors.length - 20 }} 条错误</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { transactionsAPI } from '@/api/index.js'

// ── Toast ────────────────────────────────────────────────────────────────────
const toasts = ref([])
let _toastId = 0
function addToast(message, type = 'success') {
  const id = ++_toastId
  toasts.value.push({ id, message, type })
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 3500)
}

// ── State ─────────────────────────────────────────────────────────────────────
const jsonText = ref('')
const isValid = ref(false)
const validateStatus = ref(null)
const importing = ref(false)
const importResult = ref(null)

const exampleJSON = `[
  {
    "type": "purchase_self",
    "actor_qq": "12345678",
    "item_name": "素材名称",
    "price": 188,
    "occurred_at": "2026-01-15"
  },
  {
    "type": "purchase_sponsor",
    "actor_qq": "12345678",
    "target_qq": "87654321",
    "item_name": "素材名称",
    "price": 188,
    "occurred_at": "2026-01-16"
  }
]`

const VALID_TYPES = ['purchase_self', 'purchase_sponsor', 'sponsored', 'transfer_out', 'transfer_in']
const TYPES_NEEDING_TARGET = ['purchase_sponsor', 'sponsored', 'transfer_out', 'transfer_in']

function fillExample() {
  jsonText.value = exampleJSON
  isValid.value = false
  validateStatus.value = null
  importResult.value = null
}

function clearAll() {
  jsonText.value = ''
  isValid.value = false
  validateStatus.value = null
  importResult.value = null
}

function validate() {
  importResult.value = null
  if (!jsonText.value.trim()) {
    validateStatus.value = { type: 'error', message: '请先输入 JSON 数据' }
    isValid.value = false
    return
  }
  try {
    const data = JSON.parse(jsonText.value.trim())
    if (!Array.isArray(data)) {
      validateStatus.value = { type: 'error', message: '数据格式错误：必须是 JSON 数组' }
      isValid.value = false
      return
    }
    if (data.length === 0) {
      validateStatus.value = { type: 'error', message: '数组为空，请添加交易记录' }
      isValid.value = false
      return
    }

    const errors = []
    data.forEach((item, idx) => {
      const n = idx + 1
      if (!item.type) errors.push(`第 ${n} 条：缺少 type 字段`)
      else if (!VALID_TYPES.includes(item.type)) errors.push(`第 ${n} 条：type 值无效（${item.type}）`)
      if (!item.actor_qq) errors.push(`第 ${n} 条：缺少 actor_qq 字段`)
      if (!item.item_name) errors.push(`第 ${n} 条：缺少 item_name 字段`)
      if (item.price == null) errors.push(`第 ${n} 条：缺少 price 字段`)
      if (!item.occurred_at) errors.push(`第 ${n} 条：缺少 occurred_at 字段`)
      if (item.type && TYPES_NEEDING_TARGET.includes(item.type) && !item.target_qq) {
        errors.push(`第 ${n} 条：${item.type} 类型需要 target_qq 字段`)
      }
    })

    if (errors.length > 0) {
      const shown = errors.slice(0, 5).join(' | ')
      const more = errors.length > 5 ? `...还有 ${errors.length - 5} 个问题` : ''
      validateStatus.value = { type: 'error', message: `发现 ${errors.length} 个问题：${shown}${more}` }
      isValid.value = false
    } else {
      validateStatus.value = { type: 'success', message: `格式验证通过，共 ${data.length} 条记录，可以导入` }
      isValid.value = true
    }
  } catch (e) {
    validateStatus.value = { type: 'error', message: `JSON 解析错误：${e.message}` }
    isValid.value = false
  }
}

async function handleImport() {
  if (!isValid.value) { validate(); return }
  importing.value = true
  importResult.value = null
  try {
    const data = JSON.parse(jsonText.value.trim())
    const res = await transactionsAPI.importBatch(data)
    const successCount = res.success ?? res.imported ?? 0
    const failCount = res.failed ?? res.errors?.length ?? 0
    importResult.value = {
      type: failCount > 0 ? 'error' : 'success',
      title: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      message: res.message || '',
      errors: res.errors || []
    }
    addToast(`导入完成：成功 ${successCount} 条，失败 ${failCount} 条`, failCount === 0 ? 'success' : 'warning')
    if (failCount === 0) { jsonText.value = ''; isValid.value = false; validateStatus.value = null }
  } catch (e) {
    importResult.value = { type: 'error', title: '导入请求失败', message: e?.message || '请求失败', errors: [] }
    addToast(e?.message || '导入失败', 'error')
  } finally {
    importing.value = false
  }
}
</script>
