<template>
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">VIP 批量导入</div>
        <div class="page-subtitle">通过 JSON 格式批量导入 VIP 顾客信息</div>
      </div>
      <RouterLink to="/vip/customers" class="btn btn-secondary">← 返回顾客列表</RouterLink>
    </div>

    <div class="page">
      <div class="import-zone">
        <!-- Description -->
        <div class="import-desc">
          <div class="import-desc-title">📋 格式说明</div>
          <p>请将 VIP 顾客数据整理为 JSON 数组格式，每条记录包含以下字段：</p>
          <div style="margin-top:10px">
            <p><code>qq</code> — QQ 号（必填）</p>
            <p><code>vip_level</code> — VIP 等级，1~5 的整数（必填）</p>
            <p><code>points</code> — 积分数量（可选，默认为0）</p>
            <p><code>platform</code> — 平台名称（可选）</p>
            <p><code>platform_id</code> — 平台 ID / 昵称（可选）</p>
            <p><code>annual_spend</code> — 年度消费金额（可选，默认为0）</p>
          </div>

          <div class="code-block" style="margin-top:12px">{{ exampleJSON }}</div>

          <div class="warning-text mt-3">
            ⚠️ 注意：若 QQ 号对应的顾客已存在，导入将更新其 VIP 等级和积分；若不存在，则创建新记录。
          </div>
        </div>

        <!-- JSON Editor -->
        <div class="form-group" style="margin-bottom:16px">
          <label class="form-label">JSON 数据</label>
          <textarea
            v-model="jsonText"
            class="form-textarea"
            style="min-height:240px;font-family:'Courier New',monospace;font-size:12px"
            placeholder="请粘贴 JSON 数组格式的 VIP 数据..."
          ></textarea>
        </div>

        <!-- Validate Status -->
        <div v-if="validateStatus" class="import-result" :class="validateStatus.type" style="margin-bottom:16px">
          <div class="import-result-title">{{ validateStatus.message }}</div>
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-secondary" @click="validate">验证格式</button>
          <button class="btn btn-primary" :disabled="importing || !isValid" @click="handleImport">
            {{ importing ? '导入中...' : '确认导入' }}
          </button>
          <button class="btn btn-ghost" @click="fillExample">填入示例</button>
          <button class="btn btn-ghost" style="color:#ef4444" @click="clearAll">清空</button>
        </div>

        <!-- Import Result -->
        <div v-if="importResult" class="import-result mt-4" :class="importResult.type">
          <div class="import-result-title">{{ importResult.title }}</div>
          <div class="text-sm text-muted mt-2">{{ importResult.message }}</div>
          <ul v-if="importResult.errors && importResult.errors.length > 0" class="error-list mt-2">
            <li v-for="(err, i) in importResult.errors.slice(0, 20)" :key="i">{{ err }}</li>
            <li v-if="importResult.errors.length > 20">...还有 {{ importResult.errors.length - 20 }} 条错误</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { vipsAPI } from '../api/index.js'

const addToast = inject('addToast')

const jsonText = ref('')
const isValid = ref(false)
const validateStatus = ref(null)
const importing = ref(false)
const importResult = ref(null)

const exampleJSON = `[
  {"qq": "12345678", "vip_level": 3, "points": 5688},
  {"qq": "87654321", "vip_level": 1, "points": 120, "platform": "易次元", "platform_id": "某某某"},
  {"qq": "11223344", "vip_level": 5, "points": 25000, "annual_spend": 800}
]`

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
    validateStatus.value = { type: 'error', message: '❌ 请先输入 JSON 数据' }
    isValid.value = false
    return
  }
  try {
    const data = JSON.parse(jsonText.value.trim())
    if (!Array.isArray(data)) {
      validateStatus.value = { type: 'error', message: '❌ 数据格式错误：必须是 JSON 数组' }
      isValid.value = false
      return
    }
    if (data.length === 0) {
      validateStatus.value = { type: 'error', message: '❌ 数组为空，请添加 VIP 数据' }
      isValid.value = false
      return
    }

    const errors = []
    data.forEach((item, idx) => {
      if (!item.qq) errors.push(`第 ${idx + 1} 条：缺少 qq 字段`)
      if (item.vip_level == null) errors.push(`第 ${idx + 1} 条：缺少 vip_level 字段`)
      if (item.vip_level != null && (item.vip_level < 1 || item.vip_level > 10)) {
        errors.push(`第 ${idx + 1} 条：vip_level 应为 1~10 的整数`)
      }
    })

    if (errors.length > 0) {
      validateStatus.value = {
        type: 'error',
        message: `❌ 发现 ${errors.length} 个问题：${errors.slice(0, 3).join(' | ')}${errors.length > 3 ? '...' : ''}`
      }
      isValid.value = false
    } else {
      validateStatus.value = { type: 'success', message: `✓ 格式验证通过，共 ${data.length} 条 VIP 记录，可以导入` }
      isValid.value = true
    }
  } catch (e) {
    validateStatus.value = { type: 'error', message: `❌ JSON 解析错误：${e.message}` }
    isValid.value = false
  }
}

async function handleImport() {
  if (!isValid.value) { validate(); return }

  importing.value = true
  importResult.value = null

  try {
    const data = JSON.parse(jsonText.value.trim())
    const res = await vipsAPI.importVips({ vips: data })

    if (res.error) {
      importResult.value = { type: 'error', title: '导入失败', message: res.error, errors: res.errors || [] }
      addToast('error', '导入失败', res.error)
    } else {
      const successCount = res.success || res.imported || 0
      const failCount = res.failed || res.errors?.length || 0
      importResult.value = {
        type: failCount > 0 ? 'error' : 'success',
        title: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
        message: res.message || '',
        errors: res.errors || []
      }
      addToast(
        failCount === 0 ? 'success' : 'warning',
        '导入完成',
        `成功 ${successCount} 条，失败 ${failCount} 条`
      )
      if (failCount === 0) {
        jsonText.value = ''
        isValid.value = false
        validateStatus.value = null
      }
    }
  } catch (e) {
    importResult.value = { type: 'error', title: '请求失败', message: e.message }
    addToast('error', '请求失败', e.message)
  } finally {
    importing.value = false
  }
}
</script>
