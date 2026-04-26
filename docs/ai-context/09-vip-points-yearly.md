# VIP, Points, Yearly Spend

更新时间：2026-04-26

## 业务目标

用户购买素材获得积分和年度消费，积分决定 VIP 等级。VIP 等级提供转让、回购、插队等权益次数。管理端可维护 VIP 等级配置、导入老 VIP、重置次数和清零年度消费。

## 关键文件

| 层 | 文件 |
|----|------|
| VIP 模型 | `backend/models/VipLevel.js` |
| 用户模型 | `backend/models/User.js` |
| VIP 服务 | `backend/services/vipService.js` |
| 管理 VIP 路由 | `backend/routes/admin/vips.js` |
| 管理 VIP 控制器 | `backend/controllers/admin/vipController.js` |
| 前台 VIP 页 | `frontend-vue/src/views/VipBenefits.vue` |
| 管理 VIP 客户页 | `admin-vue/src/views/VipCustomers.vue` |
| 管理 VIP 等级页 | `admin-vue/src/views/VipLevels.vue` |
| 管理 VIP 导入页 | `admin-vue/src/views/VipImport.vue` |

## 用户 VIP 字段

模型：`backend/models/User.js`

| 字段 | 说明 |
|------|------|
| `vip_level` | 当前 VIP 等级，0 为普通用户 |
| `points_total` | 累计积分 |
| `annual_spend` | 年度消费 |
| `transfer_remaining` | 剩余转让次数 |
| `buyback_remaining` | 剩余回购次数 |
| `skip_queue_remaining` | 剩余插队次数 |
| `roles` | VIP 用户通常包含 `vip` |

## VIP 等级配置

模型：`backend/models/VipLevel.js`

典型字段：

- 等级。
- 积分门槛。
- 转让次数。
- 回购次数。
- 插队次数。

初始化/补种：`vipService.seedVipLevels()`。

## 积分和年度消费

一般规则：

- 自购：`points_total += price`，`annual_spend += price`。
- VIP 插队购买：同自购，同时扣插队次数。
- 赞助方：增加赞助方积分/消费。
- 被赞助方：获得授权，但积分通常为 0。
- 转出：动态上可显示扣分效果，但历史积分口径按业务实现处理。
- 回购：按回购审核逻辑创建交易并调整次数。

购买、导入和审核后，需要调用 VIP 服务刷新用户等级和权益次数。

## 管理 VIP API

路由：`backend/routes/admin/vips.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/vips/import` | 批量导入 VIP 用户 |
| GET | `/api/admin/vips/levels` | 查询等级配置 |
| POST | `/api/admin/vips/levels` | 新建等级 |
| PUT | `/api/admin/vips/levels/:id` | 更新等级 |
| GET | `/api/admin/vips/customers` | 查询 VIP 客户 |
| PATCH | `/api/admin/vips/customers/:id` | 修改 VIP 客户 |
| POST | `/api/admin/vips/reset-counters` | 按等级重置权益次数 |
| POST | `/api/admin/vips/reset-annual-spend` | 清零年度消费 |

## VIP 导入

页面：`admin-vue/src/views/VipImport.vue`

后端：`vipController.importVips`

可通过 QQ 或邮箱创建/匹配用户，并设置：

- `vip_level`
- `points_total`
- `annual_spend`
- 平台/圈名 legacy 字段
- 权益次数
- `roles` 包含 `vip`

## 年度维护

管理端功能：

- `resetCounters`：按 VIP 等级重置转让、回购、插队次数。
- `resetAnnualSpend`：清零年度消费，但当前实现不自动降级。
- 手动降级：`updateVipCustomer`。如果用户 `annual_spend > 0`，手动降级会被限制。

## 常见修改点

- 等级权益字段：`VipLevel.js` 和 `vipService.js`。
- 购买后积分更新：`shopController.js`、`assetController.js`、`transactionController.js`。
- VIP 管理页面：`VipCustomers.vue`、`VipLevels.vue`、`VipImport.vue`。
- 核心回归：`backend/scripts/verify-core-flows.js` 中 VIP 流程。
