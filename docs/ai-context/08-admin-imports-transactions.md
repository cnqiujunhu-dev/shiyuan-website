# Admin Imports and Transactions

更新时间：2026-04-26

## 业务目标

管理后台支持批量导入交易和授权素材，用于补录历史购买、赞助和授权关系。导入时会按 QQ、圈名 ID、领域、平台、UID 等字段查找或创建用户，并写入 Ownership 与 Transaction。

## 关键文件

| 层 | 文件 |
|----|------|
| 交易模型 | `backend/models/Transaction.js` |
| 授权模型 | `backend/models/Ownership.js` |
| 用户模型 | `backend/models/User.js` |
| 导入路由 | `backend/routes/admin/transactions.js` |
| 导入控制器 | `backend/controllers/admin/transactionController.js` |
| 交易列表页 | `admin-vue/src/views/Transactions.vue` |
| 导入页面 | `admin-vue/src/views/TransactionImport.vue` |

## API

路由：`backend/routes/admin/transactions.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/transactions/import` | 导入购买/赞助交易 |
| POST | `/api/admin/transactions/import-authorizations` | 导入授权素材持有人 |
| GET | `/api/admin/transactions` | 查询交易流水 |

## 交易导入

用于补录购买流水。常见字段：

- 商品信息：`item_id`、`item_name`、`sku_code`。
- 交易类型：self / sponsor 等。
- 行为用户：QQ、平台、圈名 ID。
- 目标用户：赞助对象信息。
- 时间和金额。

导入后通常会：

- 创建或匹配用户。
- 创建 Ownership。
- 创建 Transaction。
- 更新积分、年度消费、VIP 等级。

## 授权素材导入

用于直接导入某素材的授权持有人。现在要求或支持附带身份信息：

| 字段 | 说明 |
|------|------|
| `domain1` / `领域1` | 第一个用户身份领域，`文游作者`、`美工美化`、`小说作者` |
| `circle_id1` / `圈名ID1` | 第一个用户圈名 ID |
| `uid1` | 文游作者 UID |
| `qq1` | 第一个用户 QQ |
| `domain2` / `领域2` | 第二个用户身份领域 |
| `circle_id2` / `圈名ID2` | 第二个用户圈名 ID |
| `uid2` | 第二个用户 UID |
| `qq2` | 第二个用户 QQ |

后端还兼容一些别名：

- `role`、`identity_role`、`domain`、`field`
- `nickname`、`platform_id`、`circle_id`、`circle_name`
- `uid`、`writer_uid`、`platform_uid`

## 用户匹配规则

核心函数位于 `transactionController.js`：

- `findOrCreateUser`
- `getImportIdentity`
- `getImportQq`
- `getImportDisplayId`
- `getImportAcquisitionType`

匹配优先级大致为：

1. QQ 精确匹配。
2. 身份子文档匹配：role + platform + nickname + uid。
3. legacy 字段匹配：platform + platform_id。
4. 找不到则创建用户。

如果导入中提供 QQ，而匹配到的用户缺 QQ，会补写 `user.qq`；如 email 缺失，也会按 `{qq}@qq.com` 补写。

## 身份写入规则

导入授权时会创建或补齐用户身份，再把授权归属写入 Ownership 身份快照字段：

- `identity_id`
- `identity_role`
- `identity_nickname`
- `identity_uid`

文游作者必须有 UID。前端导入页和后端都要校验。

## 管理端导入页

页面：`admin-vue/src/views/TransactionImport.vue`

职责：

- 提供导入 JSON 文案示例。
- 前端做基础字段校验。
- 显示导入成功/失败统计和错误行。
- 调用 `transactionsAPI.importBatch` 或 `transactionsAPI.importAuthorizations`。

## 常见修改点

- 新增导入字段别名：`transactionController.getImportIdentity`。
- 修改用户匹配策略：`findOrCreateUser`。
- 修改前端示例和校验：`TransactionImport.vue`。
- 交易列表展示：`Transactions.vue` 和 `getTransactions`。
