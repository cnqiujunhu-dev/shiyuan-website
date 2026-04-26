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
        <div class="import-desc-title">授权信息格式说明</div>
        <p style="margin:8px 0;">请将授权记录整理为 JSON 数组格式，每条记录支持以下字段：</p>
        <ul style="margin:8px 0 12px 16px;font-size:13px;line-height:2;">
          <li><code>sku_code</code> 或 <code>name</code> — SKU 编码或素材名称（必填，需与系统中已有素材匹配）</li>
          <li><code>acquisition_type_1</code> — 用户1获取类型：自用 / 已赞助 / 赞助待定（必填）</li>
          <li><code>id1</code> — 用户1 ID（与 qq1 至少填一项）</li>
          <li><code>qq1</code> — 用户1 QQ</li>
          <li><code>domain1</code> / <code>领域1</code> — 用户1领域：文游作者 / 美工美化 / 小说作者</li>
          <li><code>circle_id1</code> / <code>圈名ID1</code> — 用户1圈名 ID；领域为文游作者时需提供 <code>uid1</code></li>
          <li><code>points1</code> — 用户1积分</li>
          <li><code>delivery_link_1</code> — 用户1发货链接</li>
          <li><code>acquisition_type_2</code> — 用户2获取类型：被赞助（选填）</li>
          <li><code>id2</code> — 用户2 ID</li>
          <li><code>qq2</code> — 用户2 QQ</li>
          <li><code>domain2</code> / <code>领域2</code>、<code>circle_id2</code> / <code>圈名ID2</code> — 用户2身份信息</li>
          <li><code>points2</code> — 用户2积分</li>
          <li><code>delivery_link_2</code> — 用户2发货链接</li>
        </ul>
        <div class="code-block">{{ authExampleJSON }}</div>
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label">JSON 数据</label>
        <textarea
          v-model="jsonText"
          class="form-textarea"
          style="min-height:280px;font-family:'Courier New',monospace;font-size:12px;"
          placeholder="请粘贴 JSON 数组格式的授权记录..."
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
    "sku_code": "251202",
    "name": "佛本无相",
    "acquisition_type_1": "自用",
    "domain1": "文游作者",
    "circle_id1": "2673",
    "uid1": "WY-2673",
    "qq1": "123456789",
    "points1": 39,
    "delivery_link_1": "https://pan.example.com/xxx"
  },
  {
    "name": "夜渡海",
    "acquisition_type_1": "已赞助",
    "domain1": "美工美化",
    "circle_id1": "画师A",
    "qq1": "234567890",
    "points1": 39,
    "delivery_link_1": "",
    "acquisition_type_2": "被赞助",
    "domain2": "小说作者",
    "circle_id2": "作者B",
    "qq2": "123456789",
    "points2": 0,
    "delivery_link_2": "https://pan.example.com/yyy"
  },
  {
    "name": "佛本无相",
    "acquisition_type_1": "赞助待定",
    "domain1": "美工美化",
    "circle_id1": "画师C",
    "qq1": "345678901",
    "points1": 39,
    "delivery_link_1": ""
  }
]`

const identityRoles = ['文游作者', '美工美化', '小说作者', '美工', '美化', '画师', '文游', '作者']

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
  jsonText.value = authExampleJSON
  isValid.value = false
  validateStatus.value = null
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
    const VALID_TYPES = ['自用', '已赞助', '被赞助', '赞助待定', '赞待', 'self', 'sponsor', 'sponsored', 'sponsor_pending']
    data.forEach((item, idx) => {
      const n = idx + 1
      if (!item.name && !item.sku_code) errors.push(`第 ${n} 条：缺少 name 或 sku_code 字段`)
      const t1 = firstValue(item, ['acquisition_type_1', 'acquisition_type1', 'type1', 'type_1', '获取类型1', '获取类型_1'])
      if (!t1) errors.push(`第 ${n} 条：缺少 acquisition_type_1 字段`)
      else if (!VALID_TYPES.includes(t1)) errors.push(`第 ${n} 条：acquisition_type_1 值无效（${t1}）`)
      const role1 = importIdentityRole(item, '1')
      const nickname1 = importIdentityNickname(item, '1')
      if (!importDisplayId(item, '1') && !importQq(item, '1') && !nickname1) {
        errors.push(`第 ${n} 条：用户1需至少提供 id1、qq1 或圈名ID1`)
      }
      if (role1 && !identityRoles.includes(role1)) {
        errors.push(`第 ${n} 条：领域1 仅支持文游作者、美工美化、小说作者`)
      }
      if (['文游作者', '文游', '作者'].includes(role1) && !importIdentityUid(item, '1')) {
        errors.push(`第 ${n} 条：领域1 为文游作者时需填写 uid1/文游UID1`)
      }
      const role2 = importIdentityRole(item, '2')
      if (role2 && !identityRoles.includes(role2)) {
        errors.push(`第 ${n} 条：领域2 仅支持文游作者、美工美化、小说作者`)
      }
      if (['文游作者', '文游', '作者'].includes(role2) && !importIdentityUid(item, '2')) {
        errors.push(`第 ${n} 条：领域2 为文游作者时需填写 uid2/文游UID2`)
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
    const data = JSON.parse(jsonText.value.trim())
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
