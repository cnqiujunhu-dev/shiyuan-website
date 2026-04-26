# Data Models and API Map

更新时间：2026-04-26

## MongoDB 模型

路径：`material-management-system/backend/models`

| 模型 | 文件 | 说明 |
|------|------|------|
| User | `User.js` | 用户、QQ、身份、VIP 字段、注册审核状态 |
| Item | `Item.js` | 素材商品、价格、归类、预览图、发货链接 |
| Ownership | `Ownership.js` | 用户对素材的授权持有记录，含身份快照 |
| Transaction | `Transaction.js` | 积分/购买/转让/赞助/回购流水 |
| Application | `Application.js` | 注册、身份、回购等审核申请 |
| VipLevel | `VipLevel.js` | VIP 等级门槛和权益次数 |
| RegistrationVerification | `RegistrationVerification.js` | QQ 邮箱验证码 |
| AuditLog | `AuditLog.js` | 管理操作审计日志 |
| Asset | `Asset.js` | 历史/兼容资产模型，优先确认当前调用点后再使用 |

## 核心关系

- User 1:N Ownership。
- Item 1:N Ownership。
- User 1:N Transaction。
- Item 1:N Transaction。
- User 1:N Application。
- Ownership 可通过 `replaced_by` 指向后续 Ownership，用于转让/回购链路。
- Ownership 保存身份快照字段，避免用户身份后续变更影响历史授权。

## 用户端 API

### `/api/auth`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/register/send-code` | `sendRegisterCode` | 发送注册 QQ 验证码 |
| POST | `/register/verify-code` | `verifyRegisterCode` | 校验注册验证码 |
| POST | `/register` | `register` | 提交注册身份审核 |
| POST | `/login/send-code` | `sendLoginCode` | 发送登录 QQ 验证码 |
| POST | `/login/code` | `loginWithCode` | QQ 验证码登录 |
| POST | `/login` | `login` | 密码登录兼容入口，普通用户禁用 |
| POST | `/email/send-verify` | `sendVerifyEmail` | 旧邮箱验证 |
| POST | `/email/verify` | `verifyEmail` | 旧邮箱验证确认 |
| POST | `/password/forgot` | `forgotPassword` | 旧找回密码 |
| POST | `/password/reset` | `resetPassword` | 旧重置密码 |
| POST | `/password/change` | `changePassword` | 修改密码 |

### `/api/me`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| GET | `/summary` | `getSummary` | 当前用户概览 |
| POST | `/identities` | `addIdentity` | 新增身份审核 |
| GET | `/activities` | `getActivities` | 账户动态 |

### `/api/assets`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| GET | `/` | `getMyAssets` | 我的素材 |
| POST | `/transfer` | `transferAsset` | 转让 |
| POST | `/sponsor` | `sponsorAsset` | 赞助 |
| POST | `/register-sponsor` | `registerSponsor` | 登记/确认被赞助 |

### `/api/applications`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/buyback` | `submitBuyback` | 提交回购 |
| GET | `/` | `getMyApplications` | 我的申请 |

### `/api/shop`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| GET | `/items` | `getShopItems` | 店铺素材 |
| GET | `/vip-levels` | `getVipLevels` | VIP 等级 |
| POST | `/items/:id/buy` | `buySelf` | 自购 |
| POST | `/items/:id/skip-queue` | `skipQueueBuy` | VIP 插队购买 |

## 管理端 API

### `/api/admin/auth`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/login` | `adminLogin` | 管理员用户名密码登录 |

### `/api/admin/items`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/` | `createItem` | 创建商品 |
| POST | `/import` | `importItems` | 批量导入商品 |
| PUT | `/:id` | `updateItem` | 更新商品 |
| GET | `/` | `getItems` | 商品列表 |
| GET | `/:id` | `getItemById` | 商品详情 |
| GET | `/:id/ownerships` | `getItemOwnerships` | 授权名单 |
| GET | `/:id/ownerships/export` | `exportItemOwnerships` | 导出授权名单 |
| PATCH | `/:id/ownerships/:ownershipId` | `updateItemOwnership` | 修订授权 |

### `/api/admin/transactions`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/import` | `importTransactions` | 导入交易 |
| POST | `/import-authorizations` | `importAuthorizations` | 导入授权素材 |
| GET | `/` | `getTransactions` | 交易列表 |

### `/api/admin/vips`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/import` | `importVips` | 导入 VIP |
| GET | `/levels` | `getLevels` | VIP 等级 |
| POST | `/levels` | `createLevel` | 新建等级 |
| PUT | `/levels/:id` | `updateLevel` | 更新等级 |
| GET | `/customers` | `getVipCustomers` | VIP 客户 |
| PATCH | `/customers/:id` | `updateVipCustomer` | 修改 VIP 客户 |
| POST | `/reset-counters` | `resetCounters` | 重置权益次数 |
| POST | `/reset-annual-spend` | `resetAnnualSpend` | 清零年度消费 |

### `/api/admin/users`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| GET | `/` | `getUsers` | 用户列表 |
| GET | `/:id` | `getUserDetail` | 用户详情 |
| PUT | `/:id` | `updateUser` | 更新用户 |

### `/api/admin/applications`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| GET | `/` | `getApplications` | 审核列表 |
| PATCH | `/:id` | `decideApplication` | 审核处理 |

### `/api/admin/transfers`

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| GET | `/` | `getTransfers` | 转让列表 |
| POST | `/:id/rollback` | `rollbackTransfer` | 回滚转让 |
