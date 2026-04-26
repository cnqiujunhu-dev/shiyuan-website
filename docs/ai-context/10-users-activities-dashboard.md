# Users, Activities, Dashboards

更新时间：2026-04-26

## 业务目标

用户端展示当前账户概览、素材动态、VIP 权益和个人资料。管理端展示用户详情、后台首页数据和运营查询入口。

## 关键文件

| 层 | 文件 |
|----|------|
| 用户模型 | `backend/models/User.js` |
| 交易模型 | `backend/models/Transaction.js` |
| 我的信息路由 | `backend/routes/me.js` |
| 我的信息控制器 | `backend/controllers/meController.js` |
| 管理用户路由 | `backend/routes/admin/users.js` |
| 管理用户控制器 | `backend/controllers/admin/userController.js` |
| 用户首页布局 | `frontend-vue/src/views/Home.vue` |
| 我的素材页 | `frontend-vue/src/views/MyAssets.vue` |
| 账户动态页 | `frontend-vue/src/views/Activities.vue` |
| 个人资料页 | `frontend-vue/src/views/Profile.vue` |
| VIP 权益页 | `frontend-vue/src/views/VipBenefits.vue` |
| 管理后台首页 | `admin-vue/src/views/Dashboard.vue` |
| 管理用户列表 | `admin-vue/src/views/Users.vue` |
| 管理用户详情 | `admin-vue/src/views/UserDetail.vue` |

## 用户端路由

文件：`frontend-vue/src/router/index.js`

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | `auth/Login.vue` | QQ 验证码登录 |
| `/register` | `auth/Register.vue` | QQ 验证注册 + 身份登记 |
| `/forgot-password` | `auth/ForgotPassword.vue` | 旧密码找回功能 |
| `/my-assets` | `MyAssets.vue` | 我的素材 |
| `/profile` | `Profile.vue` | 个人资料和新增身份 |
| `/activities` | `Activities.vue` | 账户动态 |
| `/vip` | `VipBenefits.vue` | VIP 权益 |
| `/help` | `Help.vue` | 帮助/申请入口 |
| `/shop` | `Shop.vue` | 店铺授权 |

## 我的信息 API

路由：`backend/routes/me.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/me/summary` | 获取当前用户概览 |
| POST | `/api/me/identities` | 新增身份审核 |
| GET | `/api/me/activities` | 获取账户动态 |

`meController.getSummary` 通常返回用户基础信息、VIP 信息、身份列表和统计。`getActivities` 基于 Transaction 查询账户流水。

## 账户动态

页面：`frontend-vue/src/views/Activities.vue`

数据来源：`GET /api/me/activities`

展示内容：

- 购买自用。
- 赞助。
- 被赞助。
- 转出。
- 转入。
- 回购相关流水。

动态里的素材、对象用户、积分变化和时间来自 Transaction 与关联模型 populate。

## 管理用户 API

路由：`backend/routes/admin/users.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 用户列表和搜索 |
| GET | `/api/admin/users/:id` | 用户详情 |
| PUT | `/api/admin/users/:id` | 修改用户资料 |

管理用户详情会展示：

- 基础资料。
- QQ、邮箱、UID。
- 身份列表。
- VIP 信息。
- 素材/交易/申请关联数据。

## 后台首页

页面：`admin-vue/src/views/Dashboard.vue`

用于运营概览。若要调整统计口径，先定位对应 API 调用，再进后端控制器查 aggregate 或 count 逻辑。

## 常见修改点

- 用户详情字段：`User.js`、`userController.js`、`UserDetail.vue`。
- 账户动态类型映射：`meController.getActivities` 和 `Activities.vue`。
- 前台导航：`Home.vue`。
- 管理端导航：`admin-vue/src/views/Layout.vue`。
