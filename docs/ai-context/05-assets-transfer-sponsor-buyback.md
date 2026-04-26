# Assets, Transfer, Sponsor, Buyback

更新时间：2026-04-26

## 业务目标

用户在“我的素材”中查看自己的授权记录，可执行 VIP 转让、赞助他人、登记被赞助和提交回购申请。授权记录以 `Ownership` 为核心，所有交易流水写入 `Transaction`。

## 关键文件

| 层 | 文件 |
|----|------|
| 授权模型 | `backend/models/Ownership.js` |
| 商品模型 | `backend/models/Item.js` |
| 交易模型 | `backend/models/Transaction.js` |
| 资产路由 | `backend/routes/assets.js` |
| 资产控制器 | `backend/controllers/assetController.js` |
| 回购申请控制器 | `backend/controllers/applicationController.js` |
| 审核控制器 | `backend/controllers/admin/applicationController.js` |
| 用户素材页 | `frontend-vue/src/views/MyAssets.vue` |
| 用户帮助页 | `frontend-vue/src/views/Help.vue` |
| 管理转让页 | `admin-vue/src/views/Transfers.vue` |
| 转让管理控制器 | `backend/controllers/admin/transferController.js` |

## 我的素材

API：

- `GET /api/assets`

控制器：`assetController.getMyAssets`

行为：

- 默认只展示 active 且不是 `transfer_out` 的授权。
- 可按题材、画师、获取类型筛选。
- 发货链接只对可见类型展示，如自用、转入、被赞助。
- 转让产生的 `transfer_out` 默认隐藏，供回购等后台逻辑使用。

## 授权类型

`Ownership.acquisition_type` 枚举：

| 类型 | 说明 |
|------|------|
| `self` | 自购或转入后的有效持有 |
| `sponsor` | 赞助方记录，无发货链接 |
| `sponsored` | 被赞助方记录，有发货链接 |
| `sponsor_pending` | 赞助待接收/登记 |
| `transfer_in` | 转入交易流水口径 |
| `transfer_out` | 转出记录，默认不展示给用户 |

注意：实际接收转让后，接收方会拥有一条 active `self` 授权；交易流水中区分 transfer in/out。

## 转让流程

API：

- `POST /api/assets/transfer`

控制器：`assetController.transferAsset`

核心规则：

1. 只有 VIP 且有剩余转让次数的用户可以转让。
2. 原授权必须 active、属于当前用户、可转让。
3. 转出后原授权 inactive。
4. 创建转出方 `transfer_out` 记录。
5. 创建接收方 active `self` 记录。
6. 两边创建 `Transaction`。
7. 扣减转出方 `transfer_remaining`。
8. 接收方授权身份按目标用户身份和素材归类选择。
9. 转出方身份优先保留原授权上的身份快照。

## 赞助流程

API：

- `POST /api/assets/sponsor`
- `POST /api/assets/register-sponsor`

控制器：

- `assetController.sponsorAsset`
- `assetController.registerSponsor`

典型场景：

- 已登录用户为他人购买素材：创建赞助方记录和被赞助方记录。
- 被赞助方后续登记/确认：更新或补齐对应授权关系。

身份规则：

- 赞助方记录使用赞助方身份。
- 被赞助方记录使用目标用户身份，并按素材归类匹配。

## 回购流程

用户 API：

- `POST /api/applications/buyback`

控制器：

- 提交：`applicationController.submitBuyback`
- 审核：`adminApplicationController.decideApplication`

流程：

1. 用户选择可回购的 `transfer_out` 授权提交申请。
2. 创建 `Application(type: 'buyback')`。
3. 管理员审核通过后：
   - 关闭原 `transfer_out`。
   - 关闭接收方授权。
   - 为申请人创建回收后的 active `self` 授权。
   - 创建回购交易流水。
   - 扣减 `buyback_remaining`。
4. 重复提交 pending 回购会被拒绝。

## 转让回滚

管理 API：

- `POST /api/admin/transfers/:id/rollback`

控制器：`backend/controllers/admin/transferController.js`

用途：管理员处理异常转让，将转出和接收关系回滚。涉及多条 Ownership 和 Transaction，必须在 transaction 中执行。

## 常见修改点

- 我的素材列表字段：`frontend-vue/src/views/MyAssets.vue` 和 `assetController.getMyAssets`。
- 转让规则：`assetController.transferAsset`。
- 赞助规则：`assetController.sponsorAsset`、`assetController.registerSponsor`。
- 回购审核规则：`applicationController.js` 和 `admin/applicationController.js`。
- 授权身份快照：`backend/utils/identity.js` 和 `Ownership.js`。
