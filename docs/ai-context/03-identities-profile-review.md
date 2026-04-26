# User Identities, Profile, Review

更新时间：2026-04-26

## 业务目标

用户必须登记至少一个身份。身份用于审核、授权归属、导入匹配和授权名单展示。

身份字段：

| 字段 | 说明 |
|------|------|
| `role` | `文游作者`、`美工美化`、`小说作者` 三选一 |
| `platform` | `全平台`、`橙光`、`易次元`、`闪艺`、`晋江`、`番茄`、`微博`、`小红书`、`抖音`、`快手` |
| `nickname` | 圈名 ID |
| `uid` | 文游作者必填，其他身份可为空 |
| `is_primary` | 是否主身份 |
| `status` | `pending`、`approved`、`rejected` |

## 关键文件

| 层 | 文件 |
|----|------|
| 身份工具 | `backend/utils/identity.js` |
| 用户模型 | `backend/models/User.js` |
| 注册控制器 | `backend/controllers/authController.js` |
| 我的资料控制器 | `backend/controllers/meController.js` |
| 审核控制器 | `backend/controllers/admin/applicationController.js` |
| 前台注册页 | `frontend-vue/src/views/auth/Register.vue` |
| 前台资料页 | `frontend-vue/src/views/Profile.vue` |
| 管理审核页 | `admin-vue/src/views/Applications.vue` |
| 管理用户详情 | `admin-vue/src/views/UserDetail.vue` |

## 注册时身份登记

注册页先验证 QQ，再显示身份登记。

界面行为：

- 显示已验证 QQ，当前不可修改。
- 第一个身份是主身份。
- 角落按钮“新增副身份”可一次提交多个身份。
- 当 `role === '文游作者'` 时显示 UID 输入框并必填。
- 提交后创建注册审核申请，账号 pending，不能登录。

后端行为：

- `authController.register` 接收 `identities` 数组。
- `normalizeIdentities` 统一字段别名。
- `getIdentityValidationMessage` 校验枚举、长度和 UID。
- 写入 `User.identities`，所有身份初始 `status: pending`。
- 同步 legacy 字段：
  - `User.platform = primaryIdentity.platform`
  - `User.platform_id = primaryIdentity.nickname`
- 创建 `Application(type: 'registration')`，payload 中带全部身份。

## 登录后新增身份

API：

- `POST /api/me/identities`

前台页面：`frontend-vue/src/views/Profile.vue`

流程：

1. 已登录用户填写身份。
2. 后端 `meController.addIdentity` 校验身份。
3. 新身份以 pending 状态附加到 `User.identities`。
4. 创建 `Application(type: 'identity')`。
5. 管理员审核通过后，该身份变为 approved。

## 身份审核

管理页：`admin-vue/src/views/Applications.vue`

审核类型：

- `registration`：注册审核。通过后用户 `registration_status` 改为 `approved`，注册时提交的 pending 身份也会变 approved，并发送通过邮件。
- `identity`：身份审核。通过或拒绝仅影响对应身份。
- `buyback`：回购审核，见 `05-assets-transfer-sponsor-buyback.md`。

后端：`backend/controllers/admin/applicationController.js`

注意：

- 审核通过注册时，登录资格由 `registration_status` 决定。
- 审核通过身份时，不会自动改变用户主身份，除非提交身份本身带有 `is_primary`。

## 授权归属身份选择

工具：`backend/utils/identity.js`

核心方法：

- `getActiveIdentities(user)`：过滤 rejected 身份。
- `getPrimaryIdentity(user)`：优先主身份，再 approved 身份，再第一个身份。
- `selectIdentityForMaterial(user, materialDomain)`：
  - 如果用户只有一个 active 身份，直接使用。
  - `文游类` 素材优先匹配 `文游作者`。
  - `美工美化类` 素材优先匹配 `美工美化`。
  - 无匹配时回退主身份。
- `buildOwnershipIdentityFields(identity)`：生成写入 Ownership 的身份快照字段。

授权记录会保存身份快照：

- `identity_id`
- `identity_role`
- `identity_nickname`
- `identity_uid`

这样即使用户后续新增或修改身份，历史授权名单仍能保留当时归属信息。

## 常见修改点

- 身份角色和平台枚举：`backend/utils/identity.js`。
- User 身份 schema：`backend/models/User.js`。
- 注册身份 UI：`frontend-vue/src/views/auth/Register.vue`。
- 登录后新增身份 UI：`frontend-vue/src/views/Profile.vue`。
- 审核展示：`admin-vue/src/views/Applications.vue`、`admin-vue/src/views/UserDetail.vue`。
