# System Architecture

更新时间：2026-04-26

## 总体结构

项目是一个素材授权管理系统，包含三个运行单元：

| 单元 | 路径 | 技术栈 | 职责 |
|------|------|--------|------|
| API 后端 | `material-management-system/backend` | Express + Mongoose | 认证、素材、授权、交易、VIP、审核、邮件 |
| 用户前台 | `material-management-system/frontend-vue` | Vue 3 + Vite + Pinia | 普通用户注册登录、素材查看、购买、转让、赞助、个人资料 |
| 管理后台 | `material-management-system/admin-vue` | Vue 3 + Vite + Pinia | 管理员登录、商品、授权、交易导入、VIP、用户、审核 |

生产部署参见：

- `material-management-system/DEPLOY.md`
- `material-management-system/deploy/install.sh`
- `material-management-system/deploy/nginx.conf`

## 后端入口

入口文件：`material-management-system/backend/server.js`

主要职责：

- 读取 `.env`。
- 连接 MongoDB：`config/db.js`。
- 启用 CORS、Helmet、Morgan、JSON body parser、全局 rate limit。
- 暴露上传文件目录 `/uploads`。
- 挂载 API 路由：
  - `/api/auth`
  - `/api/me`
  - `/api/assets`
  - `/api/applications`
  - `/api/shop`
  - `/api/admin/auth`
  - `/api/admin/items`
  - `/api/admin/transactions`
  - `/api/admin/vips`
  - `/api/admin/users`
  - `/api/admin/applications`
  - `/api/admin/transfers`
- 暴露健康检查 `/api/health`。

## 前台入口

路径：`material-management-system/frontend-vue`

关键文件：

| 文件 | 说明 |
|------|------|
| `src/router/index.js` | 用户端路由守卫，登录后进入 `/my-assets` |
| `src/stores/auth.js` | 用户登录态，保存 `token`、`user`、`refreshToken` |
| `src/api/index.js` | 用户端 API 封装，统一处理 401 |
| `src/views/auth/Login.vue` | QQ 验证码登录页 |
| `src/views/auth/Register.vue` | QQ 验证码注册 + 身份登记 |
| `src/views/Home.vue` | 登录后布局和导航 |

默认开发端口：5173。API 代理到 `http://localhost:3000`。

## 管理后台入口

路径：`material-management-system/admin-vue`

关键文件：

| 文件 | 说明 |
|------|------|
| `src/router/index.js` | 管理端路由守卫，要求 `adminToken` 且用户角色含 `admin` |
| `src/stores/auth.js` | 管理端登录态，保存 `adminToken`、`adminUser` |
| `src/api/index.js` | 管理端 API 封装，登录走 `/admin/auth/login` |
| `src/views/Login.vue` | 管理后台用户名密码登录页 |
| `src/views/Layout.vue` | 管理后台导航布局 |

默认开发端口：5174。API 代理到 `http://localhost:3000`。

## 数据库和事务

数据库：MongoDB。

关键写操作使用 Mongoose session transaction：

- 购买自用。
- VIP 插队购买。
- 转让。
- 赞助和被赞助登记。
- 回购审核。
- 转让回滚。
- 交易/授权导入中的批量写入。

因此生产 MongoDB 必须运行副本集，即使单机部署也要配置单节点副本集。

## 认证与权限边界

- JWT 鉴权中间件：`backend/middleware/auth.js`。
- 角色校验：`backend/middleware/roles.js`。
- 普通用户接口通常只要求 `auth`。
- 管理员接口通常使用 `[auth, requireRole('admin')]`。
- 审核接口允许 `admin` 或 `reviewer`：`requireRole('admin', 'reviewer')`。
- 管理后台登录独立接口：`/api/admin/auth/login`。

## 上传和静态资源

- 后端上传目录默认 `backend/uploads`，可由 `UPLOAD_DIR` 环境变量覆盖。
- 商品预览图由管理端商品表单上传。
- 生产 Nginx 通常将 `/uploads/` alias 到后端上传目录。
