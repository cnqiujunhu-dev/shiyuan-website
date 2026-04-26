# Admin Items and Ownerships

更新时间：2026-04-26

## 业务目标

管理端负责商品维护、商品导入、授权名单查看、授权信息修订和导出。商品支持素材归类，授权名单会显示归属身份信息。

## 关键文件

| 层 | 文件 |
|----|------|
| 商品模型 | `backend/models/Item.js` |
| 授权模型 | `backend/models/Ownership.js` |
| 管理商品路由 | `backend/routes/admin/items.js` |
| 管理商品控制器 | `backend/controllers/admin/itemController.js` |
| 商品列表页 | `admin-vue/src/views/Items.vue` |
| 商品表单页 | `admin-vue/src/views/ItemForm.vue` |
| 授权名单页 | `admin-vue/src/views/ItemOwnerships.vue` |
| 管理端 API | `admin-vue/src/api/index.js` |

## 管理商品 API

路由：`backend/routes/admin/items.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/items` | 创建商品，支持上传预览图 |
| POST | `/api/admin/items/import` | 批量导入商品 |
| PUT | `/api/admin/items/:id` | 更新商品 |
| GET | `/api/admin/items` | 查询商品列表 |
| GET | `/api/admin/items/:id` | 获取商品详情 |
| GET | `/api/admin/items/:id/ownerships` | 查看商品授权顾客 |
| GET | `/api/admin/items/:id/ownerships/export` | 导出授权名单 CSV |
| PATCH | `/api/admin/items/:id/ownerships/:ownershipId` | 修订单条授权 |

## 商品创建/编辑

页面：`admin-vue/src/views/ItemForm.vue`

字段：

- 编号 `sku_code`
- 名称 `name`
- 画师/作者 `artist`
- 素材归类 `material_domain`
- 题材 `topics`
- 分类 `categories`
- 价格 `price`
- 状态 `status`
- 预览图 `preview`
- 发货链接 `delivery_link`
- VIP/排队相关配置

素材归类选项：

- `文游类`
- `美工美化类`

后端 `itemController.normalizeMaterialDomain` 接受部分别名，如 `文游`、`文游作者`、`美工`、`美化`。

## 商品批量导入

页面：`admin-vue/src/views/Items.vue`

API：`POST /api/admin/items/import`

输入 JSON 数组，每个对象可包含：

- `sku_code`
- `preview_url`
- `name`
- `material_domain`
- `topics`
- `categories`
- `artist`
- `price`
- `delivery_link`
- `status`

## 授权名单

页面：`admin-vue/src/views/ItemOwnerships.vue`

列表显示：

- 用户信息。
- 授权类型。
- 领域/身份角色 `identity_role`。
- 圈名 ID `identity_nickname`。
- UID `identity_uid`。
- QQ。
- 发货链接。
- active 状态。

授权名单优先读取 Ownership 上的身份快照，缺失时回退到用户 legacy 字段。

## 导出 CSV

API：`GET /api/admin/items/:id/ownerships/export`

导出字段包含：

- 商品编号。
- 商品名称。
- 素材归类。
- 授权类型。
- 身份领域。
- 圈名 ID。
- QQ。
- UID。
- 用户名。
- 时间。

## 常见修改点

- 商品字段：`backend/models/Item.js`、`ItemForm.vue`。
- 商品导入字段：`itemController.importItems` 和 `Items.vue`。
- 授权名单展示/导出：`itemController.getItemOwnerships`、`exportItemOwnerships`、`ItemOwnerships.vue`。
- 授权修订：`updateItemOwnership`。
