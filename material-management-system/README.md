# 诸城叙梦素材管理平台

面向游戏/视觉小说创作者的授权素材管理系统，支持 VIP 会员体系、素材购买与赞助、版权转让与回购全流程。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 API | Node.js 20 + Express + Mongoose |
| 数据库 | MongoDB 7 |
| 用户前台 | Vue 3 + Vite + Pinia |
| 管理后台 | Vue 3 + Vite + Pinia |
| 生产部署 | Nginx + PM2 + Let's Encrypt |

## 项目结构

```
material-management-system/
├── backend/              # Express API（端口 3000）
│   ├── controllers/      # 业务控制器
│   ├── models/           # Mongoose 数据模型
│   ├── routes/           # API 路由
│   ├── middleware/       # JWT 认证、权限校验
│   ├── services/         # VIP 同步、邮件等服务
│   ├── scripts/          # 数据库种子脚本
│   ├── .env.example      # 环境变量模板
│   └── server.js         # 应用入口
├── frontend-vue/         # 用户前台（Vue 3）
│   └── src/views/        # Dashboard / Shop / MyAssets / Applications / Help ...
├── admin-vue/            # 管理后台（Vue 3）
│   └── src/views/        # Items / Transactions / VIP / Users / Applications ...
└── deploy/
    └── nginx.conf        # Nginx 生产配置示例
```

## 核心功能

**用户端**
- 注册 / 登录 / 邮箱验证 / 找回密码
- 查看个人资产（授权列表）、积分与 VIP 等级
- 店铺购买（普通购买 / VIP 专属 / 限量插队购买）
- 素材赞助给他人
- 申请变更使用平台 / 申请印刷报告 / 申请素材回购
- VIP 权益说明与使用记录查询

**管理端**
- 素材（Item）管理：上架、编辑、设置 VIP 限制 / 排队限购
- 交易流水管理：手动录入、CSV 批量导入
- VIP 管理：等级配置、用户查询、年度重置
- 用户管理：查看、冻结
- 申请审批：平台变更 / 印刷报告 / 素材回购

## 快速启动（开发环境）

```bash
# 1. 后端
cd backend
cp .env.example .env   # 填写 MONGODB_URI 和 JWT_SECRET
npm install
npm run dev            # 监听 3000 端口

# 2. 用户前台
cd frontend-vue
npm install
npm run dev            # 监听 5173 端口

# 3. 管理后台
cd admin-vue
npm install
npm run dev            # 监听 5174 端口
```

访问：
- 用户前台：http://localhost:5173
- 管理后台：http://localhost:5174
- API：http://localhost:3000/api

## 生产部署

详见 [DEPLOY.md](./DEPLOY.md)。

## 许可证

仅限内部使用，未经授权不得对外分发。
