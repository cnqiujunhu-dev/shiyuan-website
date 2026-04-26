# AI Context Index

更新时间：2026-04-26

这个目录给后续 AI 或维护者快速理解项目结构使用。阅读顺序建议：

1. `01-system-architecture.md`：先看系统边界、三端结构和部署形态。
2. `11-data-models-and-api-map.md`：再看核心模型和 API 路由总表。
3. 按任务类型阅读对应功能文档。
4. 改动前后参考 `12-development-deploy-verification.md` 跑验证。

## 功能文档

| 文档 | 覆盖范围 |
|------|----------|
| `01-system-architecture.md` | 仓库结构、后端/前台/后台边界、运行入口 |
| `02-auth-registration-login.md` | QQ 验证码注册登录、管理员独立登录、邮件验证码 |
| `03-identities-profile-review.md` | 用户身份、圈名 ID、文游 UID、注册和身份审核 |
| `04-shop-items-purchase.md` | 店铺素材、素材归类、自购、VIP 插队购买 |
| `05-assets-transfer-sponsor-buyback.md` | 我的素材、转让、赞助、被赞助登记、回购 |
| `06-applications-review.md` | 审核中心、注册审核、身份审核、回购审核 |
| `07-admin-items-ownerships.md` | 管理端商品维护、授权名单、授权导出 |
| `08-admin-imports-transactions.md` | 交易导入、授权素材导入、用户匹配规则 |
| `09-vip-points-yearly.md` | VIP 等级、积分、年度消费、次数重置 |
| `10-users-activities-dashboard.md` | 用户资料、账户动态、首页/后台仪表盘 |
| `11-data-models-and-api-map.md` | MongoDB 模型和 API 路由总览 |
| `12-development-deploy-verification.md` | 本地验证、核心脚本、生产同步流程 |

## 当前实现要点

- 后端：`material-management-system/backend`，Express + Mongoose，入口 `server.js`。
- 用户前台：`material-management-system/frontend-vue`，Vue 3 + Vite，默认开发端口 5173。
- 管理后台：`material-management-system/admin-vue`，Vue 3 + Vite，默认开发端口 5174。
- 数据库：MongoDB。购买、转让、赞助、回购等核心写操作依赖 Mongoose transaction，生产必须使用副本集。
- 登录体系：
  - 普通用户使用 QQ 号验证码登录，验证码发送到 `{qq}@qq.com`。
  - 注册也使用 QQ 验证码，验证后提交身份登记，审核通过后才能登录。
  - 管理后台使用独立用户名密码登录接口 `/api/admin/auth/login`。
- 授权身份：
  - 身份角色固定为 `文游作者`、`美工美化`、`小说作者`。
  - 平台固定为 `全平台`、`橙光`、`易次元`、`闪艺`、`晋江`、`番茄`、`微博`、`小红书`、`抖音`、`快手`。
  - `文游作者` 必填 UID。
  - 素材归类为 `文游类` 或 `美工美化类`，购买/导入授权时会尽量匹配用户对应身份。

## 修改时的基本路线

1. 找用户侧页面：`frontend-vue/src/views` 和 `frontend-vue/src/api/index.js`。
2. 找管理侧页面：`admin-vue/src/views` 和 `admin-vue/src/api/index.js`。
3. 找后端接口：`backend/routes` 先定位路由，再进 `backend/controllers`。
4. 找数据结构：`backend/models`。
5. 找身份相关规则：`backend/utils/identity.js`。
6. 找核心回归：`backend/scripts/verify-core-flows.js`。
