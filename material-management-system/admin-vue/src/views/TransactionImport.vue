<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">批量导入</h1>
        <p class="page-subtitle">通过 JSON 格式批量录入交易记录或授权信息</p>
      </div>
      <router-link to="/transactions" class="btn btn-secondary">&larr; 返回记录</router-link>
    </div>

    <!-- Tab Switch -->
    <div style="display:flex;gap:8px;margin-bottom:20px;">
      <button
        :class="['btn', activeTab === 'transactions' ? 'btn-primary' : 'btn-secondary']"
        @click="activeTab = 'transactions'; clearAll()"
      >交易记录导入</button>
      <button
        :class="['btn', activeTab === 'authorizations' ? 'btn-primary' : 'btn-secondary']"
        @click="activeTab = 'authorizations'; clearAll()"
      >授权信息导入</button>
    </div>

    <!-- Transaction Import -->
    <div v-if="activeTab === 'transactions'" class="import-zone">
      <div class="import-desc">
        <div class="import-desc-title">交易记录格式说明</div>
        <p style="margin:8px 0;">请将交易记录整理为 JSON 数组格式，每条记录支持以下字段：</p>
        <ul style="margin:8px 0 12px 16px;font-size:13px;line-height:2;">
          <li><code>type</code> — 交易类型：<code>purchase_self</code>（自购）/ <code>purchase_sponsor</code>（赞助）（必填）</li>
          <li><code>actor_qq</code> — 操作方 QQ 号（必填）</li>
          <li><code>sku_code</code> 或 <code>item_name</code> — SKU 编码或素材名称（必填，需与系统中已有素材匹配）</li>
          <li><code>price</code> — 交易价格，单位积分（必填）</li>
          <li><code>occurred_at</code> — 交易日期，格式 <code>YYYY-MM-DD</code>（必填）</li>
          <li><code>target_qq</code> — 目标方 QQ（赞助类型必填）</li>
        </ul>
        <div class="code-block">{{ txExampleJSON }}</div>
      </div>

      <div class="info-text" style="margin:16px 0;">
        <strong>导入规则：</strong>操作方/目标方会优先通过 QQ 或圈名 ID 匹配；未匹配到时会创建占位用户，后续可在顾客详情中补充信息。素材名称需与系统中现有素材匹配。重复导入同一条记录不会自动去重。
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label">JSON 数据</label>
        <textarea
          v-model="jsonText"
          class="form-textarea"
          style="min-height:280px;font-family:'Courier New',monospace;font-size:12px;"
          placeholder="请粘贴 JSON 数组格式的交易记录..."
        ></textarea>
      </div>

      <div v-if="validateStatus" class="import-result" :class="validateStatus.type" style="margin-bottom:16px;">
        <div class="import-result-title">{{ validateStatus.message }}</div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn btn-secondary" @click="validateTx">验证格式</button>
        <button class="btn btn-primary" :disabled="importing || !isValid" @click="handleImportTx">
          {{ importing ? '导入中...' : '确认导入' }}
        </button>
        <button class="btn btn-ghost" @click="fillTxExample">填入示例</button>
        <button class="btn btn-ghost" style="color:#ef4444;" @click="clearAll">清空</button>
      </div>

      <div v-if="importResult" class="import-result" :class="importResult.type">
        <div class="import-result-title">{{ importResult.title }}</div>
        <div v-if="importResult.message" style="font-size:13px;margin-top:6px;opacity:0.85;">{{ importResult.message }}</div>
        <ul v-if="importResult.errors && importResult.errors.length > 0" class="error-list" style="margin-top:8px;">
          <li v-for="(err, i) in importResult.errors.slice(0, 20)" :key="i">{{ typeof err === 'string' ? err : err.error }}</li>
          <li v-if="importResult.errors.length > 20" style="opacity:0.7;">...还有 {{ importResult.errors.length - 20 }} 条错误</li>
        </ul>
      </div>
    </div>

    <!-- Authorization Import -->
    <div v-if="activeTab === 'authorizations'" class="import-zone">
      <div class="import-desc">
        <div class="import-desc-title">授权名单 Excel 格式说明</div>
        <p style="margin:8px 0;">请上传 Excel .xlsx 授权名单；也可以临时粘贴同字段 JSON 数组。固定列如下：</p>
        <ul style="margin:8px 0 12px 16px;font-size:13px;line-height:2;">
          <li><code>素材 SKU</code> / <code>素材名称</code> — 至少填写一项，用于匹配素材</li>
          <li><code>使用领域</code> — 文游作者 / 小说作者 / 非重氪独立游戏作者 / 美工</li>
          <li><code>获取途径</code> — 购买 / 活动购买 / 被赞助 / 回购 / 会员帮回购 / 中奖 / 退圈掉落</li>
          <li><code>用途</code> — 自用 / 赞助待定 / 赞助确定</li>
          <li><code>购买人 ID</code>、<code>购买人 QQ</code>、<code>实际使用人 ID</code>、<code>实际使用人 QQ</code></li>
          <li><code>积分</code> 可为空，系统按素材原价和获取途径自动计算；<code>发货链接</code> 可为空，默认使用素材发货链接</li>
        </ul>
        <div class="code-block">{{ authExampleJSON }}</div>
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label">Excel 文件</label>
        <input type="file" accept=".xlsx,.xls" class="form-input" @change="onAuthFileSelect" />
        <span v-if="authFile" class="form-hint">已选择：{{ authFile.name }}</span>
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label">JSON 数据（可选）</label>
        <textarea
          v-model="jsonText"
          class="form-textarea"
          style="min-height:280px;font-family:'Courier New',monospace;font-size:12px;"
          placeholder="可粘贴与 Excel 固定列同名的 JSON 数组..."
        ></textarea>
      </div>

      <div v-if="validateStatus" class="import-result" :class="validateStatus.type" style="margin-bottom:16px;">
        <div class="import-result-title">{{ validateStatus.message }}</div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn btn-secondary" @click="validateAuth">验证格式</button>
        <button class="btn btn-primary" :disabled="importing || !isValid" @click="handleImportAuth">
          {{ importing ? '导入中...' : '确认导入' }}
        </button>
        <button class="btn btn-ghost" @click="fillAuthExample">填入示例</button>
        <button class="btn btn-ghost" style="color:#ef4444;" @click="clearAll">清空</button>
      </div>

      <div v-if="importResult" class="import-result" :class="importResult.type">
        <div class="import-result-title">{{ importResult.title }}</div>
        <div v-if="importResult.message" style="font-size:13px;margin-top:6px;opacity:0.85;">{{ importResult.message }}</div>
        <ul v-if="importResult.errors && importResult.errors.length > 0" class="error-list" style="margin-top:8px;">
          <li v-for="(err, i) in importResult.errors.slice(0, 20)" :key="i">{{ typeof err === 'string' ? err : err.error }}</li>
          <li v-if="importResult.errors.length > 20" style="opacity:0.7;">...还有 {{ importResult.errors.length - 20 }} 条错误</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { transactionsAPI } from '@/api/index.js'

const _addToast = inject('addToast')
function addToast(message, type = 'success') { _addToast(type, message) }

const activeTab = ref('transactions')
const jsonText = ref('')
const authFile = ref(null)
const isValid = ref(false)
const validateStatus = ref(null)
const importing = ref(false)
const importResult = ref(null)

const txExampleJSON = `[
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

const authExampleJSON = `[
  {
    "素材 SKU": "251202",
    "素材名称": "佛本无相",
    "使用领域": "文游作者",
    "获取途径": "购买",
    "用途": "自用",
    "购买人 ID": "作者A",
    "购买人 QQ": "123456789",
    "实际使用人 ID": "作者A",
    "实际使用人 QQ": "123456789",
    "积分": "",
    "发货链接": "https://pan.example.com/xxx",
    "备注": ""
  },
  {
    "素材名称": "夜渡海",
    "使用领域": "小说作者",
    "获取途径": "活动购买",
    "用途": "赞助确定",
    "购买人 ID": "赞助人A",
    "购买人 QQ": "234567890",
    "实际使用人 ID": "作者B",
    "实际使用人 QQ": "123456789",
    "积分": "",
    "发货链接": "",
    "备注": "活动赞助"
  },
  {
    "素材名称": "旧素材",
    "使用领域": "美工",
    "获取途径": "会员帮回购",
    "用途": "自用",
    "购买人 ID": "VIP会员",
    "购买人 QQ": "345678901",
    "实际使用人 ID": "被帮回购人",
    "实际使用人 QQ": "456789012",
    "积分": "",
    "发货链接": "",
    "备注": "会员帮回购"
  }
]`

const usageFields = ['文游作者', '小说作者', '非重氪独立游戏作者', '美工']
const acquisitionMethods = ['购买', '活动购买', '被赞助', '回购', '会员帮回购', '中奖', '退圈掉落']
const usagePurposes = ['自用', '赞助待定', '赞助确定']

function firstValue(record, names) {
  for (const name of names) {
    const value = record[name]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

function importIdentityRole(record, suffix) {
  return firstValue(record, [
    `domain${suffix}`, `field${suffix}`, `identity_role_${suffix}`, `identity_role${suffix}`,
    `领域${suffix}`, `领域_${suffix}`,
    ...(suffix === '1' ? ['domain', 'field', '领域', '身份领域'] : [])
  ])
}

function importIdentityNickname(record, suffix) {
  return firstValue(record, [
    `circle_id${suffix}`, `circle_id_${suffix}`, `nickname${suffix}`, `nickname_${suffix}`,
    `platform_id${suffix}`, `platform_id_${suffix}`, `圈名ID${suffix}`, `圈名ID_${suffix}`, `圈名${suffix}`,
    ...(suffix === '1' ? ['circle_id', 'nickname', 'platform_id', '圈名ID', '圈名'] : [])
  ])
}

function importIdentityUid(record, suffix) {
  return firstValue(record, [
    `uid${suffix}`, `uid_${suffix}`, `writer_uid${suffix}`, `writer_uid_${suffix}`,
    `platform_uid${suffix}`, `platform_uid_${suffix}`, `UID${suffix}`, `UID_${suffix}`,
    `文游UID${suffix}`, `文游UID_${suffix}`,
    ...(suffix === '1' ? ['uid', 'writer_uid', 'platform_uid', 'UID', '文游UID'] : [])
  ])
}

function importQq(record, suffix) {
  return firstValue(record, [
    `qq${suffix}`, `qq_${suffix}`, `QQ${suffix}`, `QQ_${suffix}`,
    ...(suffix === '1' ? ['qq', 'QQ'] : [])
  ])
}

function importDisplayId(record, suffix) {
  return firstValue(record, [
    `id${suffix}`, `id_${suffix}`, `user_id${suffix}`, `user_id_${suffix}`, `用户ID${suffix}`, `用户ID_${suffix}`,
    ...(suffix === '1' ? ['id', 'user_id', '用户ID'] : [])
  ])
}

function clearAll() {
  jsonText.value = ''
  authFile.value = null
  isValid.value = false
  validateStatus.value = null
  importResult.value = null
}

function fillTxExample() {
  jsonText.value = txExampleJSON
  isValid.value = false
  validateStatus.value = null
  importResult.value = null
}

function fillAuthExample() {
  authFile.value = null
  jsonText.value = authExampleJSON
  isValid.value = false
  validateStatus.value = null
  importResult.value = null
}

function onAuthFileSelect(event) {
  const file = event.target.files?.[0]
  authFile.value = file || null
  isValid.value = !!file
  validateStatus.value = file
    ? { type: 'success', message: `已选择 Excel 文件：${file.name}` }
    : null
  importResult.value = null
}

function validateTx() {
  importResult.value = null
  if (!jsonText.value.trim()) {
    validateStatus.value = { type: 'error', message: '请先输入 JSON 数据' }
    isValid.value = false
    return
  }
  try {
    const data = JSON.parse(jsonText.value.trim())
    if (!Array.isArray(data) || data.length === 0) {
      validateStatus.value = { type: 'error', message: '数据格式错误：必须是非空 JSON 数组' }
      isValid.value = false
      return
    }

    const errors = []
    const VALID_TYPES = ['purchase_self', 'purchase_sponsor']
    data.forEach((item, idx) => {
      const n = idx + 1
      if (!item.type) errors.push(`第 ${n} 条：缺少 type 字段`)
      else if (!VALID_TYPES.includes(item.type)) errors.push(`第 ${n} 条：type 值无效（${item.type}）`)
      if (!item.actor_qq) errors.push(`第 ${n} 条：缺少 actor_qq 字段`)
      if (!item.item_name && !item.sku_code) errors.push(`第 ${n} 条：缺少 item_name 或 sku_code 字段`)
      if (item.price == null) errors.push(`第 ${n} 条：缺少 price 字段`)
      if (!item.occurred_at) errors.push(`第 ${n} 条：缺少 occurred_at 字段`)
      if (item.type === 'purchase_sponsor' && !item.target_qq) {
        errors.push(`第 ${n} 条：赞助类型需要 target_qq 字段`)
      }
    })

    if (errors.length > 0) {
      validateStatus.value = { type: 'error', message: `发现 ${errors.length} 个问题：${errors.slice(0, 3).join(' | ')}` }
      isValid.value = false
    } else {
      validateStatus.value = { type: 'success', message: `格式验证通过，共 ${data.length} 条记录` }
      isValid.value = true
    }
  } catch (e) {
    validateStatus.value = { type: 'error', message: `JSON 解析错误：${e.message}` }
    isValid.value = false
  }
}

function validateAuth() {
  importResult.value = null
  if (authFile.value) {
    validateStatus.value = { type: 'success', message: `将上传 Excel 文件：${authFile.value.name}` }
    isValid.value = true
    return
  }
  if (!jsonText.value.trim()) {
    validateStatus.value = { type: 'error', message: '请先选择 Excel 文件或输入 JSON 数据' }
    isValid.value = false
    return
  }
  try {
    const data = JSON.parse(jsonText.value.trim())
    if (!Array.isArray(data) || data.length === 0) {
      validateStatus.value = { type: 'error', message: '数据格式错误：必须是非空 JSON 数组' }
      isValid.value = false
      return
    }

    const errors = []
    data.forEach((item, idx) => {
      const n = idx + 1
      if (!firstValue(item, ['素材 SKU', '素材SKU', 'SKU', 'sku_code']) && !firstValue(item, ['素材名称', 'name', 'item_name'])) {
        errors.push(`第 ${n} 条：素材 SKU 和素材名称至少填写一个`)
      }
      const usageField = firstValue(item, ['使用领域', 'usage_field'])
      const acquisitionMethod = firstValue(item, ['获取途径', 'acquisition_method'])
      const usagePurpose = firstValue(item, ['用途', 'usage_purpose'])
      if (!usageFields.includes(usageField)) errors.push(`第 ${n} 条：使用领域无效（${usageField || '空'}）`)
      if (!acquisitionMethods.includes(acquisitionMethod)) errors.push(`第 ${n} 条：获取途径无效（${acquisitionMethod || '空'}）`)
      if (!usagePurposes.includes(usagePurpose)) errors.push(`第 ${n} 条：用途无效（${usagePurpose || '空'}）`)
      if (!firstValue(item, ['购买人 ID', '购买人ID', 'purchaser_id']) && !firstValue(item, ['购买人 QQ', '购买人QQ', 'purchaser_qq'])) {
        errors.push(`第 ${n} 条：购买人 ID 和购买人 QQ 至少填写一个`)
      }
      if (usagePurpose !== '赞助待定' && !firstValue(item, ['实际使用人 ID', '实际使用人ID', 'actual_id']) && !firstValue(item, ['实际使用人 QQ', '实际使用人QQ', 'actual_qq'])) {
        errors.push(`第 ${n} 条：非赞助待定记录需要实际使用人 ID 或 QQ`)
      }
    })

    if (errors.length > 0) {
      validateStatus.value = { type: 'error', message: `发现 ${errors.length} 个问题：${errors.slice(0, 3).join(' | ')}` }
      isValid.value = false
    } else {
      validateStatus.value = { type: 'success', message: `格式验证通过，共 ${data.length} 条记录` }
      isValid.value = true
    }
  } catch (e) {
    validateStatus.value = { type: 'error', message: `JSON 解析错误：${e.message}` }
    isValid.value = false
  }
}

async function handleImportTx() {
  if (!isValid.value) { validateTx(); return }
  importing.value = true
  importResult.value = null
  try {
    const data = JSON.parse(jsonText.value.trim())
    const res = await transactionsAPI.importBatch(data)
    const successCount = res.imported ?? res.success ?? 0
    const failCount = res.failed ?? res.errors?.length ?? 0
    importResult.value = {
      type: failCount > 0 ? 'error' : 'success',
      title: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      message: res.message || '',
      errors: res.errors || []
    }
    addToast(`导入完成：成功 ${successCount} 条`, failCount === 0 ? 'success' : 'warning')
    if (failCount === 0) clearAll()
  } catch (e) {
    importResult.value = { type: 'error', title: '导入请求失败', message: e?.message || '请求失败', errors: [] }
    addToast(e?.message || '导入失败', 'error')
  } finally {
    importing.value = false
  }
}

async function handleImportAuth() {
  if (!isValid.value) { validateAuth(); return }
  importing.value = true
  importResult.value = null
  try {
    const data = authFile.value
      ? (() => {
          const fd = new FormData()
          fd.append('file', authFile.value)
          return fd
        })()
      : JSON.parse(jsonText.value.trim())
    const res = await transactionsAPI.importAuthorizations(data)
    const successCount = res.imported ?? res.success ?? 0
    const failCount = res.failed ?? res.errors?.length ?? 0
    importResult.value = {
      type: failCount > 0 ? 'error' : 'success',
      title: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      message: res.message || '',
      errors: res.errors || []
    }
    addToast(`导入完成：成功 ${successCount} 条`, failCount === 0 ? 'success' : 'warning')
    if (failCount === 0) clearAll()
  } catch (e) {
    importResult.value = { type: 'error', title: '导入请求失败', message: e?.message || '请求失败', errors: [] }
    addToast(e?.message || '导入失败', 'error')
  } finally {
    importing.value = false
  }
}
</script>
