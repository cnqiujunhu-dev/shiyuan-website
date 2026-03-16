# 素材管理系统（Digital Asset Management System）

本仓库包含一个完整的素材管理系统的开发代码、服务器配置及部署说明。该系统旨在为团队或企业提供统一的数字资产存储、管理和分享平台，支持图片、视频、文档等各类素材的上传、分类、标签管理、检索、版本控制以及权限管理等功能。下文详细说明了系统架构、核心功能、安装部署步骤以及服务器硬件/软件要求。

## 核心功能概述

根据公开资料，数字资产管理（DAM）系统应至少包含以下功能：

- **集中存储与分类**：所有数字资产在服务器上集中存放，可以按照类别、文件夹或标签进行分类管理【740514223723060†L210-L260】。
- **版本控制**：系统可以存储文件的历史版本，支持回溯或下载旧版【740514223723060†L219-L225】。
- **访问控制**：提供角色权限管理，确保只有被授权的用户才能访问或操作指定资源【740514223723060†L223-L233】。
- **元数据标签与检索**：通过元数据（标题、描述、关键词、标签、创建日期等）以及全文搜索功能，用户可以快速查找素材【18299215023029†L57-L60】。
- **上传与下载**：支持多种文件格式的上传，记录文件基本信息（名称、大小、类型、上传者），并允许用户下载原始文件或预览缩略图。
- **日志与审计**：记录用户的上传、修改、删除及下载操作，以便审计和追踪。

文献指出，DAM系统在设计时还需考虑性能、存储成本以及网络带宽要求【740514223723060†L252-L261】。因此，本系统采用文件系统存储原始文件，通过数据库存储元数据，并使用懒加载技术对大文件进行分块传输。此外，系统提供 RESTful API，前端采用 React 实现单页应用，支持响应式设计。

## 项目结构

```
material-management-system/
├── backend/                 # 服务端代码（Node.js + Express + MongoDB）
│   ├── package.json        # 后端依赖声明
│   ├── server.js           # 应用入口
│   ├── .env.example        # 环境变量示例文件
│   ├── config/
│   │   └── db.js           # 数据库连接配置
│   ├── models/
│   │   ├── user.js         # 用户模型
│   │   └── asset.js        # 素材/资产模型
│   ├── controllers/
│   │   ├── authController.js   # 认证相关控制器
│   │   └── assetController.js  # 素材业务控制器
│   ├── routes/
│   │   ├── auth.js         # 认证相关路由
│   │   └── assets.js       # 素材相关路由
│   ├── middleware/
│   │   └── authMiddleware.js   # JWT 验证中间件
│   └── uploads/            # 文件上传目录（部署时可配置）
├── frontend/                # 前端代码（React + Vite）
│   ├── package.json        # 前端依赖声明
│   ├── vite.config.js      # 构建配置
│   ├── public/
│   │   └── index.html      # 页面模板
│   └── src/
│       ├── main.jsx        # 入口文件
│       ├── App.jsx         # 根组件
│       ├── api/
│       │   └── index.js    # 封装的 API 请求
│       ├── pages/
│       │   ├── Login.jsx   # 登录页面
│       │   ├── Register.jsx# 注册页面
│       │   ├── Dashboard.jsx # 主页/素材列表页面
│       │   └── Upload.jsx  # 上传页面
│       └── components/
│           ├── AssetList.jsx   # 素材列表组件
│           └── AssetCard.jsx   # 素材卡片展示组件
└── deploy/
    └── nginx.conf           # Nginx 反向代理配置示例
```

## 安装部署

### 服务器硬件要求

本系统定位于中小型团队或企业内部使用，基于参考资料中对数字资产管理系统存储和带宽需求的建议【740514223723060†L252-L261】以及一般经验，推荐的最小服务器配置如下：

| 资源           | 最低配置               | 建议配置             | 说明                             |
| -------------- | ---------------------- | -------------------- | -------------------------------- |
| CPU            | 2 核                   | 4 核                 | 多用户并发上传/下载建议更高核数 |
| 内存           | 4 GB                   | ≥ 8 GB               | 后端、数据库和前端构建均需内存   |
| 存储           | 50 GB SSD              | ≥ 200 GB SSD/NVMe    | 素材文件占用空间，根据需求扩展   |
| 网络带宽       | 10 Mbps                | ≥ 100 Mbps           | 保障大文件上传/下载性能         |

### 软件要求

1. **操作系统**：Ubuntu 20.04 LTS 或兼容 Linux 发行版。
2. **运行环境**：
   - [Node.js](https://nodejs.org/) ≥ 18.x（用于运行后端服务器和前端构建）。
   - [MongoDB](https://www.mongodb.com/) ≥ 6.x（数据库）。
   - [Nginx](https://nginx.org/) ≥ 1.18（用作前端静态文件和 API 的反向代理）。
3. **附加工具**：
   - `git` 用于代码管理；
   - `pm2` 或 `systemd` 用于守护 Node 进程。

### 部署步骤

1. **克隆项目**

   ```bash
   git clone <repository_url> material-management-system
   cd material-management-system
   ```

2. **配置后端**

   ```bash
   cd backend
   cp .env.example .env  # 按实际情况修改环境变量
   npm install           # 安装依赖
   npm start             # 启动开发环境
   ```

   `.env` 文件示例包括 MongoDB 连接字符串、JWT 密钥、上传目录等配置。部署时应填入实际值。

3. **配置前端**

   ```bash
   cd ../frontend
   npm install
   npm run build         # 生成生产环境静态文件
   ```

   构建后的静态文件位于 `frontend/dist/`，可由 Nginx 服务。

4. **配置 Nginx**

   在生产环境中推荐使用 Nginx 作为反向代理，将 API 请求转发到 Node.js 端口，并提供前端静态页面。`deploy/nginx.conf` 提供了示例配置：

   ```nginx
   server {
       listen       80;
       server_name  your-domain.com;

       location /api/ {
           proxy_pass         http://127.0.0.1:3000/;
           proxy_http_version 1.1;
           proxy_set_header   Upgrade $http_upgrade;
           proxy_set_header   Connection 'upgrade';
           proxy_set_header   Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location / {
           root   /var/www/material-management-system/frontend/dist;
           try_files $uri $uri/ /index.html;
       }
   }
   ```

5. **启动服务进程**

   使用 `pm2` 或 `systemd` 持久化运行 Node 服务。

   ```bash
   pm2 start server.js --name dam-backend
   pm2 save
   ```

   或者创建 `systemd` 服务文件：

   ```ini
   [Unit]
   Description=Digital Asset Management Backend
   After=network.target

   [Service]
   User=www-data
   WorkingDirectory=/var/www/material-management-system/backend
   ExecStart=/usr/bin/node server.js
   Restart=always
   Environment=NODE_ENV=production
   Environment=PORT=3000
   Environment=MONGODB_URI=mongodb://localhost:27017/dam
   Environment=JWT_SECRET=your_secret

   [Install]
   WantedBy=multi-user.target
   ```

6. **安全与备份**

   - 启用 HTTPS（TLS），可以使用 Let’s Encrypt 自动签发证书。将 Nginx 的 `listen 80` 调整为 `listen 443 ssl;`，并配置证书路径。
   - 定期备份 MongoDB 数据库和上传目录。可结合 `mongodump` 与定时任务。
   - 为上传目录配置文件扫描或限制上传类型，防止脚本上传和执行。

本项目提供了基础框架，开发者可根据实际业务需要扩展诸如自动转码、缩略图生成、批量编辑、标签推荐以及权限细分等高级功能。详细 API 文档请参考 `backend/routes/` 中的注释。
