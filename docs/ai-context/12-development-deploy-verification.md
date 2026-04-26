# Development, Verification, Production Sync

更新时间：2026-04-26

## 本地开发

后端：

```bash
cd material-management-system/backend
npm install
npm run dev
```

用户前台：

```bash
cd material-management-system/frontend-vue
npm install
npm run dev
```

管理后台：

```bash
cd material-management-system/admin-vue
npm install
npm run dev
```

默认端口：

- 后端 API：3000
- 用户前台：5173
- 管理后台：5174

## 常用验证

后端语法检查：

```bash
cd material-management-system/backend
node --check server.js
node --check controllers/authController.js
node --check controllers/assetController.js
node --check controllers/shopController.js
node --check controllers/admin/transactionController.js
node --check routes/auth.js
node --check routes/admin/auth.js
node --check utils/identity.js
```

核心业务回归：

```bash
cd material-management-system/backend
npm run verify:core
```

`verify:core` 覆盖：

- QQ 验证码注册。
- 注册身份审核。
- 审核通过后 QQ 验证码登录。
- 管理员密码登录。
- 新增身份审核。
- 转让和回购。
- VIP 导入、等级和年度维护。

前台构建：

```bash
cd material-management-system/frontend-vue
npm run build
```

管理后台构建：

```bash
cd material-management-system/admin-vue
npm run build
```

如果只想验证编译但不改仓库 `dist`，可输出到临时目录：

```bash
npm run build -- --outDir $env:TEMP\shiyuan-frontend-vue-build --emptyOutDir
npm run build -- --outDir $env:TEMP\shiyuan-admin-vue-build --emptyOutDir
```

## 生产部署结构

部署文档：`material-management-system/DEPLOY.md`

一键安装脚本：`material-management-system/deploy/install.sh`

生产推荐路径：

```bash
/var/www/shiyuan/material-management-system
```

生产服务：

- 后端由 PM2 管理，进程名 `shiyuan-api`。
- 用户前台由 Nginx 托管 `frontend-vue/dist`。
- 管理后台由 Nginx 托管 `admin-vue/dist`。
- MongoDB 必须是副本集模式。

## 生产同步命令

在生产服务器上执行：

```bash
cd /var/www/shiyuan
git pull origin master

cd material-management-system/backend
npm install --omit=dev
pm2 reload shiyuan-api

cd ../frontend-vue
npm install
npm run build

cd ../admin-vue
npm install
npm run build
```

如果生产服务器 clone 的仓库根目录就是 `material-management-system`，则把 `cd /var/www/shiyuan` 后的路径相应调整。

## 发布前检查清单

- `git status --short` 确认改动范围。
- 后端 `npm run verify:core` 通过。
- 前台和管理后台构建通过。
- 新增 API 有路由、控制器和权限守卫。
- 涉及交易/授权/VIP 的写操作保持 transaction。
- 涉及身份的授权写入时保留 Ownership 身份快照。
- 涉及邮件的功能检查 SMTP 未配置时的错误提示。
- 生产同步后访问 `/api/health`。

## 生产健康检查

```bash
curl -s https://你的域名/api/health
pm2 list
pm2 logs shiyuan-api --lines 100
```

健康检查返回 `status: ok` 表示 API 和 MongoDB 连接正常；如果是 `degraded`，优先检查 MongoDB 连接串和副本集状态。
