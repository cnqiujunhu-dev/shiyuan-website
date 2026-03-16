# 素材管理系统部署文档

> 版本：V1.0 | 更新日期：2026-03-16 | 适用环境：Ubuntu 20.04 LTS / 22.04 LTS

---

## 目录

1. [服务器环境要求](#1-服务器环境要求)
2. [依赖软件安装](#2-依赖软件安装)
3. [项目部署](#3-项目部署)
4. [Nginx 配置](#4-nginx-配置)
5. [PM2 进程管理](#5-pm2-进程管理)
6. [HTTPS 证书配置](#6-https-证书配置)
7. [MongoDB 安全加固](#7-mongodb-安全加固)
8. [环境变量说明](#8-环境变量说明)
9. [常用运维命令](#9-常用运维命令)
10. [故障排查](#10-故障排查)

---

## 1. 服务器环境要求

### 最低配置

| 资源 | 最低 | 推荐 |
|------|------|------|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 硬盘 | 50 GB SSD | 200 GB SSD |
| 带宽 | 5 Mbps | 20 Mbps |
| 操作系统 | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |

### 需要开放的端口

| 端口 | 用途 | 访问来源 |
|------|------|---------|
| 22 | SSH 登录 | 管理员 IP |
| 80 | HTTP（自动跳转 HTTPS） | 公网 |
| 443 | HTTPS | 公网 |
| 3000 | 后端 API（仅内网） | 本机 Nginx |
| 27017 | MongoDB（仅内网） | 本机 |

---

## 2. 依赖软件安装

### 2.1 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 安装 Node.js 18.x

```bash
# 使用 NodeSource 官方源
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version   # 应输出 v18.x.x
npm --version    # 应输出 9.x.x
```

### 2.3 安装 MongoDB 6.x

```bash
# 导入 GPG 密钥
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor

# 添加软件源（Ubuntu 22.04）
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

sudo apt update
sudo apt install -y mongodb-org

# 启动并设置开机自启
sudo systemctl start mongod
sudo systemctl enable mongod

# 验证状态
sudo systemctl status mongod
```

### 2.4 安装 Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2.5 安装 PM2

```bash
sudo npm install -g pm2
```

---

## 3. 项目部署

### 3.1 上传项目代码

**方式一：使用 Git（推荐）**

```bash
# 在服务器上
cd /var/www
sudo git clone <你的仓库地址> material-management-system
sudo chown -R $USER:$USER /var/www/material-management-system
```

**方式二：使用 SCP 上传**

```bash
# 在本地机器上执行
scp -r ./material-management-system user@服务器IP:/var/www/
```

### 3.2 配置后端

```bash
cd /var/www/material-management-system/backend

# 安装依赖
npm install --production

# 创建环境变量文件
cp .env.example .env
nano .env
```

编辑 `.env` 文件，填入以下内容：

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://damuser:your_strong_password@127.0.0.1:27017/dam?authSource=dam
JWT_SECRET=替换为至少64位随机字符串
UPLOAD_DIR=/var/www/material-management-system/backend/uploads
```

> **生成随机 JWT_SECRET 的方法：**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

```bash
# 创建 uploads 目录并设置权限
mkdir -p uploads
chmod 755 uploads
```

### 3.3 配置前端并构建

```bash
cd /var/www/material-management-system/frontend

# 安装依赖
npm install

# 构建生产版本
npm run build
```

构建产物位于 `frontend/dist/` 目录，供 Nginx 托管。

### 3.4 配置 MongoDB 用户（推荐）

```bash
# 进入 MongoDB shell
mongosh

# 切换到 admin 数据库创建管理员
use admin
db.createUser({
  user: "admin",
  pwd: "your_admin_password",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

# 创建应用专用数据库用户
use dam
db.createUser({
  user: "damuser",
  pwd: "your_strong_password",
  roles: [ { role: "readWrite", db: "dam" } ]
})

exit
```

启用 MongoDB 身份认证：

```bash
sudo nano /etc/mongod.conf
```

找到 `security` 部分，修改为：

```yaml
security:
  authorization: enabled
```

```bash
sudo systemctl restart mongod
```

---

## 4. Nginx 配置

### 4.1 创建 Nginx 站点配置

```bash
sudo nano /etc/nginx/sites-available/material-management-system
```

粘贴以下内容（将 `your-domain.com` 替换为实际域名）：

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # 临时 HTTP 配置，配置 HTTPS 后会自动跳转
    root /var/www/material-management-system/frontend/dist;
    index index.html;

    # 前端 SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 文件上传超时设置（大文件上传时适当调整）
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # 上传文件静态访问（如需直接访问上传文件）
    location /uploads/ {
        alias /var/www/material-management-system/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # 文件上传大小限制（根据需要调整）
    client_max_body_size 100m;

    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

### 4.2 启用站点

```bash
# 创建软链接启用站点
sudo ln -s /etc/nginx/sites-available/material-management-system \
           /etc/nginx/sites-enabled/

# 删除默认站点（可选）
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置语法
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

## 5. PM2 进程管理

### 5.1 创建 PM2 配置文件

```bash
nano /var/www/material-management-system/backend/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'dam-backend',
      script: 'server.js',
      cwd: '/var/www/material-management-system/backend',
      instances: 2,           // 根据 CPU 核心数调整，或使用 'max'
      exec_mode: 'cluster',   // 集群模式，充分利用多核
      env: {
        NODE_ENV: 'production',
      },
      // 日志配置
      out_file: '/var/log/dam/out.log',
      error_file: '/var/log/dam/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // 内存超限自动重启
      max_memory_restart: '512M',
      // 异常退出自动重启
      autorestart: true,
      watch: false,
    },
  ],
};
```

### 5.2 启动应用

```bash
# 创建日志目录
sudo mkdir -p /var/log/dam
sudo chown $USER:$USER /var/log/dam

# 进入后端目录启动
cd /var/www/material-management-system/backend
pm2 start ecosystem.config.js

# 查看运行状态
pm2 status

# 设置开机自启
pm2 startup
# 按照命令输出执行生成的 sudo 命令

# 保存当前进程列表
pm2 save
```

### 5.3 常用 PM2 命令

```bash
pm2 status              # 查看所有进程状态
pm2 logs dam-backend    # 查看日志（实时）
pm2 restart dam-backend # 重启应用
pm2 reload dam-backend  # 零停机重载（集群模式）
pm2 stop dam-backend    # 停止应用
pm2 monit               # 实时监控面板
```

---

## 6. HTTPS 证书配置

使用 Let's Encrypt 免费证书（需要域名已解析到服务器）：

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书并自动配置 Nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 按提示输入邮箱，同意条款
# Certbot 会自动修改 Nginx 配置并添加 HTTPS 重定向
```

验证自动续期：

```bash
# 测试续期（不实际续期）
sudo certbot renew --dry-run

# 证书有效期查看
sudo certbot certificates
```

Let's Encrypt 证书有效期为 90 天，Certbot 会通过 systemd timer 自动续期。

---

## 7. MongoDB 安全加固

```bash
# 编辑 MongoDB 配置
sudo nano /etc/mongod.conf
```

确保以下配置项：

```yaml
# 网络绑定（只监听本地，禁止外网直接访问）
net:
  port: 27017
  bindIp: 127.0.0.1

# 启用身份认证
security:
  authorization: enabled
```

```bash
sudo systemctl restart mongod
```

### 配置定期备份

```bash
# 创建备份脚本
nano /usr/local/bin/backup-dam.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/backups/dam
MONGO_URI="mongodb://damuser:your_strong_password@127.0.0.1:27017/dam?authSource=dam"

mkdir -p $BACKUP_DIR

# 备份数据库
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR/db_$DATE"

# 备份上传文件
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" \
  /var/www/material-management-system/backend/uploads/

# 删除 30 天前的备份
find $BACKUP_DIR -mtime +30 -delete

echo "备份完成: $DATE"
```

```bash
chmod +x /usr/local/bin/backup-dam.sh

# 添加定时任务（每天凌晨 3 点执行）
crontab -e
# 添加以下行：
# 0 3 * * * /usr/local/bin/backup-dam.sh >> /var/log/dam/backup.log 2>&1
```

---

## 8. 环境变量说明

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|---------|--------|------|
| `NODE_ENV` | 是 | `development` | 运行环境，生产必须设为 `production` |
| `PORT` | 否 | `3000` | 后端监听端口 |
| `MONGODB_URI` | 是 | 无 | MongoDB 完整连接字符串 |
| `JWT_SECRET` | 是 | 无 | JWT 签名密钥，**必须使用强随机值** |
| `UPLOAD_DIR` | 否 | `uploads` | 文件上传存储目录（建议使用绝对路径） |

**生产环境 `.env` 示例：**

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://damuser:StrongP@ssw0rd@127.0.0.1:27017/dam?authSource=dam
JWT_SECRET=a8f2c1e9d4b7f3a6c2e8d1b4f7a3c6e9d2b5f8a1c4e7d0b3f6a9c2e5d8b1f4
UPLOAD_DIR=/var/www/material-management-system/backend/uploads
```

---

## 9. 常用运维命令

### 更新部署（代码更新流程）

```bash
cd /var/www/material-management-system

# 1. 拉取最新代码
git pull origin main

# 2. 更新后端依赖（如有变更）
cd backend && npm install --production && cd ..

# 3. 重新构建前端
cd frontend && npm install && npm run build && cd ..

# 4. 零停机重载后端
pm2 reload dam-backend

# 5. 重载 Nginx（如配置有变更）
sudo nginx -t && sudo systemctl reload nginx
```

### 查看日志

```bash
# 后端应用日志（实时）
pm2 logs dam-backend

# 后端错误日志
tail -f /var/log/dam/error.log

# Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# MongoDB 日志
sudo tail -f /var/log/mongodb/mongod.log
```

### 服务状态检查

```bash
# 检查各服务状态
pm2 status
sudo systemctl status nginx
sudo systemctl status mongod

# 检查端口占用
sudo ss -tlnp | grep -E '3000|80|443|27017'

# 检查磁盘使用
df -h
du -sh /var/www/material-management-system/backend/uploads/
```

---

## 10. 故障排查

### 问题：访问网站返回 502 Bad Gateway

```bash
# 1. 检查后端是否运行
pm2 status

# 2. 检查后端是否监听 3000 端口
curl http://127.0.0.1:3000/api/auth/login

# 3. 查看后端错误日志
pm2 logs dam-backend --err

# 4. 检查 Nginx 配置
sudo nginx -t
```

### 问题：上传文件失败

```bash
# 1. 检查 uploads 目录权限
ls -la /var/www/material-management-system/backend/uploads/

# 2. 修复权限（如有问题）
sudo chown -R www-data:www-data uploads/   # Nginx 用户访问
# 或
chmod 755 uploads/

# 3. 检查磁盘空间
df -h

# 4. 检查 Nginx 文件大小限制
grep client_max_body_size /etc/nginx/sites-available/material-management-system
```

### 问题：MongoDB 连接失败

```bash
# 1. 检查 MongoDB 服务状态
sudo systemctl status mongod

# 2. 测试连接（使用应用用户）
mongosh "mongodb://damuser:your_password@127.0.0.1:27017/dam?authSource=dam"

# 3. 查看 MongoDB 日志
sudo tail -50 /var/log/mongodb/mongod.log

# 4. 重启 MongoDB
sudo systemctl restart mongod
```

### 问题：JWT Token 验证失败（401 错误）

- 检查 `.env` 中 `JWT_SECRET` 是否与签发时一致
- Token 可能已过期（默认 7 天），让用户重新登录
- 检查请求头是否正确携带 `Authorization: Bearer <token>`

### 问题：前端页面空白

```bash
# 1. 检查前端是否正确构建
ls /var/www/material-management-system/frontend/dist/

# 2. 重新构建
cd /var/www/material-management-system/frontend
npm run build

# 3. 检查 Nginx root 路径配置
grep -n "root" /etc/nginx/sites-available/material-management-system

# 4. 检查浏览器控制台错误
```

---

## 附录：快速部署检查清单

部署完成后，请逐项验证：

- [ ] MongoDB 服务正常运行，并启用身份认证
- [ ] 后端 PM2 进程状态为 `online`
- [ ] Nginx 配置测试通过（`nginx -t`）
- [ ] 访问 `http://your-domain.com` 能正常加载前端页面
- [ ] 能正常注册和登录用户
- [ ] 能正常上传文件
- [ ] 能正常查看、搜索、下载文件
- [ ] HTTPS 证书已配置，HTTP 自动跳转 HTTPS
- [ ] 定时备份脚本已配置并测试
- [ ] 服务器防火墙已配置，仅开放必要端口（22、80、443）
- [ ] PM2 开机自启已配置（`pm2 startup && pm2 save`）
- [ ] MongoDB 和 Nginx 开机自启已配置（`systemctl enable`）

---

*文档由 Claude Code 生成 | 素材管理系统 V1.0*
