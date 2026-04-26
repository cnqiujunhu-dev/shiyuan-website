# Shop, Items, Purchase

更新时间：2026-04-26

## 业务目标

用户可以浏览店铺素材，购买自用，VIP 用户可使用插队购买次数。素材可归类为 `文游类` 或 `美工美化类`，购买授权时系统根据归类选择用户对应身份。

## 关键文件

| 层 | 文件 |
|----|------|
| 商品模型 | `backend/models/Item.js` |
| 授权模型 | `backend/models/Ownership.js` |
| 交易模型 | `backend/models/Transaction.js` |
| 店铺路由 | `backend/routes/shop.js` |
| 店铺控制器 | `backend/controllers/shopController.js` |
| 身份匹配 | `backend/utils/identity.js` |
| 用户前台店铺页 | `frontend-vue/src/views/Shop.vue` |
| 用户 API | `frontend-vue/src/api/index.js` |
| 管理商品表单 | `admin-vue/src/views/ItemForm.vue` |
| 管理商品列表 | `admin-vue/src/views/Items.vue` |
| 管理商品控制器 | `backend/controllers/admin/itemController.js` |

## 商品字段

模型：`backend/models/Item.js`

主要字段：

| 字段 | 说明 |
|------|------|
| `sku_code` | 商品编号 |
| `name` | 商品名 |
| `artist` | 画师/作者 |
| `material_domain` | `文游类` 或 `美工美化类`，默认 `美工美化类` |
| `topics` | 题材标签 |
| `categories` | 分类标签 |
| `price` | 价格/积分 |
| `preview_url` | 预览图 |
| `delivery_link` | 发货链接 |
| `status` | `on_sale`、`completed`、`off_sale` |
| `priority_only` | 是否仅 VIP 插队 |
| `queue_enabled` | 是否启用排队 |

管理端商品创建/编辑已经支持 `material_domain` 选择。

## 店铺 API

路由：`backend/routes/shop.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/shop/items` | 获取店铺素材列表 |
| GET | `/api/shop/vip-levels` | 获取 VIP 等级说明 |
| POST | `/api/shop/items/:id/buy` | 自购 |
| POST | `/api/shop/items/:id/skip-queue` | VIP 插队购买 |

## 自购逻辑

控制器：`shopController.buySelf`

核心动作：

1. 校验用户和商品存在。
2. 商品必须可购买。
3. 使用 `selectIdentityForMaterial(user, item.material_domain)` 选择授权身份。
4. 创建 `Ownership`：
   - `acquisition_type: 'self'`
   - `points_delta: item.price`
   - `delivery_link: item.delivery_link`
   - 写入身份快照字段。
5. 创建 `Transaction(type: 'purchase_self')`。
6. 增加用户 `points_total` 和 `annual_spend`。
7. 根据积分刷新 VIP 等级和权益次数。
8. 全部写操作在 MongoDB transaction 中执行。

## VIP 插队购买逻辑

控制器：`shopController.skipQueueBuy`

与自购类似，但额外要求：

- 用户有 VIP 权益。
- `skip_queue_remaining > 0`。
- 购买后扣减一次 `skip_queue_remaining`。
- 交易 metadata 标记 skip queue。

## 前台店铺页

页面：`frontend-vue/src/views/Shop.vue`

主要职责：

- 拉取素材列表。
- 展示素材信息和状态。
- 调用 `shopAPI.buyItem(id)` 或 `shopAPI.skipQueueBuy(id)`。
- 购买后刷新用户/列表状态。

## 常见修改点

- 素材状态和字段：`backend/models/Item.js`。
- 商品列表筛选：`shopController.getShopItems` 和 `Shop.vue`。
- 自购/插队业务规则：`backend/controllers/shopController.js`。
- 商品归类枚举：`Item.js` 和 `admin-vue/src/views/ItemForm.vue`。
- 授权身份匹配：`backend/utils/identity.js`。
