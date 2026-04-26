# Auth, Registration, Login

更新时间：2026-04-26

## 业务目标

普通用户注册和登录都使用 QQ 验证码。用户输入 QQ 号后，系统发送验证码到 `{qq}@qq.com`。注册时验证码通过后进入身份登记，提交审核；审核通过后邮件通知用户可登录。

管理员账户和管理后台不受普通用户验证码流程影响，走独立的用户名密码登录。

## 关键文件

| 层 | 文件 |
|----|------|
| 后端控制器 | `backend/controllers/authController.js` |
| 普通认证路由 | `backend/routes/auth.js` |
| 管理认证路由 | `backend/routes/admin/auth.js` |
| 验证码模型 | `backend/models/RegistrationVerification.js` |
| 用户模型 | `backend/models/User.js` |
| 邮件服务 | `backend/services/emailService.js` |
| 用户前台登录页 | `frontend-vue/src/views/auth/Login.vue` |
| 用户前台注册页 | `frontend-vue/src/views/auth/Register.vue` |
| 用户前台 auth store | `frontend-vue/src/stores/auth.js` |
| 管理端登录页 | `admin-vue/src/views/Login.vue` |
| 管理端 API | `admin-vue/src/api/index.js` |

## 普通用户注册流程

API：

- `POST /api/auth/register/send-code`
- `POST /api/auth/register/verify-code`
- `POST /api/auth/register`

流程：

1. 用户在前台注册页输入 QQ。
2. `sendRegisterCode` 校验 QQ 格式，生成邮箱 `{qq}@qq.com`。
3. 如果该 QQ 已存在且不是 rejected 状态，拒绝再次注册。
4. 生成 6 位验证码，hash 后写入 `RegistrationVerification`，有效期 10 分钟。
5. 邮件通过 `emailService.sendRegistrationCodeEmail` 发送。
6. 用户提交验证码，`verifyRegisterCode` 校验后把记录标为 `verified_at`。
7. 用户进入身份登记界面，提交 `identities`。
8. `register` 消费已验证验证码，创建或重开 rejected 用户，状态为 `registration_status: pending`。
9. 创建 `Application`，类型为 `registration`。
10. 审核通过后用户才能登录。

普通用户注册不再要求密码。后端仍会生成随机 `password_hash`，主要为了兼容 User 模型和管理员密码逻辑。

## 普通用户登录流程

API：

- `POST /api/auth/login/send-code`
- `POST /api/auth/login/code`

流程：

1. 用户输入 QQ。
2. `sendLoginCode` 查找 `User.qq`。
3. pending 或 rejected 用户不能发送登录验证码。
4. 生成验证码，写入 `RegistrationVerification`，发送到 `{qq}@qq.com`。
5. `loginWithCode` 校验验证码并删除验证码记录。
6. 登录成功返回 `token`、`refreshToken` 和用户信息。

前台 `frontend-vue/src/stores/auth.js` 的 `login(qq, code)` 调用 `authAPI.loginWithCode`。

## 管理后台登录流程

API：

- `POST /api/admin/auth/login`

流程：

1. 管理端 `admin-vue/src/views/Login.vue` 输入用户名和密码。
2. `admin-vue/src/api/index.js` 调用 `/admin/auth/login`。
3. 后端 `authController.adminLogin` 使用 `passwordLogin({ requireAdmin: true })`。
4. 只有 `roles` 包含 `admin` 的用户可以登录。
5. 登录成功返回 JWT，管理端保存在 `adminToken`。

注意：

- `/api/auth/login` 仍保留密码登录入口，但普通非管理员会返回 `普通用户请使用 QQ 验证码登录`。
- 管理后台不要调用普通用户 QQ 登录接口。

## 验证码存储

模型：`backend/models/RegistrationVerification.js`

字段：

| 字段 | 说明 |
|------|------|
| `email` | QQ 邮箱，如 `123456@qq.com` |
| `code_hash` | 验证码 hash，默认不 select |
| `expires_at` | 过期时间，TTL index |
| `attempts` | 错误次数 |
| `verified_at` | 注册验证码通过后的标记 |
| `last_sent_at` | 控制 60 秒重发限制 |

登录验证码和注册验证码复用这个模型。登录验证码校验成功后直接删除；注册验证码先标记已验证，注册提交时消费并删除。

## 邮件配置

服务：`backend/services/emailService.js`

相关方法：

- `sendRegistrationCodeEmail(email, code)`
- `sendLoginCodeEmail(email, code)`
- `sendRegistrationApprovedEmail(email, user)`
- `sendRegistrationRejectedEmail(email, user, reason)`

SMTP 环境变量在 `backend/.env.example` 和部署文档中说明。邮件未配置时，发送验证码接口会返回错误；测试脚本会 stub 邮件方法。

## 常见修改点

- QQ 格式规则：`authController.js` 中 `isValidQq` 和路由校验。
- 验证码有效期、重发间隔：`storeVerificationCode` 和发送接口中的时间判断。
- 管理登录权限：`passwordLogin` 的 `requireAdmin` 分支。
- 注册提交字段：`Register.vue` 和 `authController.register`。
- 审核通过邮件文案：`emailService.sendRegistrationApprovedEmail`。
