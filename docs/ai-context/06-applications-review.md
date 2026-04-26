# Applications and Review Center

更新时间：2026-04-26

## 业务目标

所有需要人工判断的业务进入 `Application`。当前主要包括注册审核、身份审核和回购审核。

## 关键文件

| 层 | 文件 |
|----|------|
| 申请模型 | `backend/models/Application.js` |
| 用户申请控制器 | `backend/controllers/applicationController.js` |
| 管理审核控制器 | `backend/controllers/admin/applicationController.js` |
| 用户申请路由 | `backend/routes/applications.js` |
| 管理审核路由 | `backend/routes/admin/applications.js` |
| 管理审核页 | `admin-vue/src/views/Applications.vue` |
| 用户帮助页 | `frontend-vue/src/views/Help.vue` |

## Application 模型

主要字段：

| 字段 | 说明 |
|------|------|
| `type` | 申请类型，如 `registration`、`identity`、`buyback` |
| `user_id` | 申请人 |
| `status` | `pending`、`approved`、`rejected` |
| `payload` | 申请内容快照 |
| `reviewed_by` | 审核人 |
| `reviewed_at` | 审核时间 |
| `remark` | 审核备注 |

## 用户侧 API

路由：`backend/routes/applications.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/applications/buyback` | 提交回购申请 |
| GET | `/api/applications` | 查询我的申请 |

注册申请由 `authController.register` 自动创建，身份申请由 `meController.addIdentity` 自动创建。

## 管理侧 API

路由：`backend/routes/admin/applications.js`

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/admin/applications` | admin/reviewer | 查询申请 |
| PATCH | `/api/admin/applications/:id` | admin/reviewer | 审核通过或拒绝 |

## 注册审核

来源：`authController.register`

通过后：

- `User.registration_status = 'approved'`。
- pending 身份改为 approved。
- 记录 `registration_reviewed_by`、`registration_reviewed_at`。
- 发送审核通过邮件，提示用户使用 QQ 验证码登录。

拒绝后：

- `User.registration_status = 'rejected'`。
- 记录拒绝原因。
- 发送审核拒绝邮件。
- 用户不可登录。
- 同一 QQ 可以重新走验证码注册流程，重开 rejected 用户。

## 身份审核

来源：`meController.addIdentity`

通过后：

- 对应 `User.identities` 子文档 `status = 'approved'`。
- 记录 `reviewed_by` 和 `reviewed_at`。

拒绝后：

- 对应身份 `status = 'rejected'`。
- 记录 `reject_reason`。

## 回购审核

来源：`applicationController.submitBuyback`

通过后会修改 Ownership、Transaction 和用户次数，详见 `05-assets-transfer-sponsor-buyback.md`。

## 管理审核页

页面：`admin-vue/src/views/Applications.vue`

展示要点：

- 注册申请会展示全部身份，包含角色、平台、圈名 ID、UID。
- 身份申请展示单个身份。
- 回购申请展示素材和授权关系。
- 审核动作统一调用 `applicationsAPI.decide(id, data)`。

## 常见修改点

- 新增审核类型：先扩展 `Application.type`，再修改 `admin/applicationController.js` 的 decide 分支和管理端展示。
- 修改注册审核通过后的副作用：`admin/applicationController.js`。
- 修改审核列表筛选：`getApplications` 和 `Applications.vue`。
