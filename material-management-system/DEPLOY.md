# 诸城叙梦素材管理平台 — 生产部署文档

## 目录

1. [系统架构](#系统架构)
2. [服务器要求](#服务器要求)
3. [软件安装](#软件安装)
4. [代码获取](#代码获取)
5. [后端配置](#后端配置)
6. [构建前端](#构建前端)
7. [PM2 进程管理](#pm2-进程管理)
8. [Nginx 配置](#nginx-配置)
9. [SSL 证书](#ssl-证书)
10. [首次初始化](#首次初始化)
11. [日常维护](#日常维护)
12. [备份策略](#备份策略)
13. [故障排查](#故障排查)

---

## 系统架构

```
用户浏览器
    │
    ├─ https://your-domain.com         → Nginx → /var/www/shiyuan/frontend/dist  (Vue 3 用户前台)
    ├─ https://admin.your-domain.com   → Nginx → /var/www/shiyuan/admin/dist     (Vue 3 管理后台)
    │
    └─ /api/*  →  Nginx (反向代理)  →  Node.js :3000  →  MongoDB
```

| 子系统 | 目录 | 说明 |
|--------|------|------|
| backend | `backend/` | Express API 服务，端口 3000 |
| frontend-vue | `frontend-vue/` | 用户前台，Vue 3 + Vite |
| admin-vue | `admin-vue/` | 管理后台，Vue 3 + Vite |

---

## 服务器要求

### 硬件最低配置

| 资源 | 最低 | 建议 |
|------|------|------|
| CPU | 2 核 | 4 核 |
| 内存 | 2 GB | 4 GB |
| 系统盘 | 20 GB SSD | 40 GB SSD |
| 数据盘 | 50 GB | 200 GB（存放上传素材） |
| 带宽 | 5 Mbps | 20 Mbps |

### 软件要求

- **OS**：Ubuntu 22.04 LTS（推荐）或 Ubuntu 20.04 LTS
- **Node.js**：18.x 或 20.x LTS
- **MongoDB**：6.x 或 7.x
- **Nginx**：1.18+
- **PM2**：最新稳定版
- **Certbot**：用于 Let's Encrypt SSL

---

## 软件安装

> 以下命令以 **Ubuntu 22.04** root 用户执行，如使用普通用户请在前面加 `sudo`。

### 1. 系统更新

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential
```

### 2. 安装 Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # 应显示 v20.x.x
npm -v
```

### 3. 安装 MongoDB 7.x

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  > /etc/apt/sources.list.d/mongodb-org-7.0.list

apt update
apt install -y mongodb-org

systemctl start mongod
systemctl enable mongod
mongod --version
```

### 4. 安装 Nginx

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

### 5. 安装 PM2 和 Certbot

```bash
npm install -g pm2
apt install -y certbot python3-certbot-nginx
```

---

## 代码获取

```bash
mkdir -p /var/www/shiyuan
cd /var/www/shiyuan

git clone https://github.com/Junjun7/shiyuan-website.git .
# 或使用 SSH：git clone git@github.com:Junjun7/shiyuan-website.git .

# 确认目录结构
ls
# 应看到：backend/  frontend-vue/  admin-vue/  deploy/  ...
```

---

## 后端配置

### 1. 安装依赖

```bash
cd /var/www/shiyuan/backend
npm install --production
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env   # 或使用 vim
```

逐项填写以下内容：

```dotenv
# 运行环境
NODE_ENV=production
PORT=3000

# MongoDB 连接串（本机默认无需修改）
MONGODB_URI=mongodb://localhost:27017/shiyuan

# JWT 密钥（必须修改！各用 64 位以上随机字符串）
JWT_SECRET=在这里填写64字符以上的随机字符串_1
JWT_REFRESH_SECRET=在这里填写64字符以上的随机字符串_2

# 生成随机字符串命令：node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 文件上传目录（绝对路径或相对路径均可）
UPLOAD_DIR=uploads

# 允许跨域的前端地址（多个用逗号分隔）
CORS_ORIGIN=https://your-domain.com,https://admin.your-domain.com

# 日志级别：error / warn / info / debug
LOG_LEVEL=info

# 邮件服务（用于发验证码邮件）
MAIL_HOST=smtp.example.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=noreply@example.com
MAIL_PASS=邮箱密码或授权码
MAIL_FROM="诸城叙梦" <noreply@example.com>
```

> **安全提示**：`.env` 文件不得提交到 Git。该文件已在 `.gitignore` 中排除。

### 3. 创建上传目录

```bash
mkdir -p /var/www/shiyuan/backend/uploads
chmod 755 /var/www/shiyuan/backend/uploads
```

---

## 构建前端

### 用户前台（frontend-vue）

```bash
cd /var/www/shiyuan/frontend-vue
npm install
npm run build
# 构建产物位于 frontend-vue/dist/
```

### 管理后台（admin-vue）

```bash
cd /var/www/shiyuan/admin-vue
npm install
npm run build
# 构建产物位于 admin-vue/dist/
```

> 将构建产物移动到 Nginx 的 root 目录：

```bash
mkdir -p /var/www/shiyuan/frontend/dist
mkdir -p /var/www/shiyuan/admin/dist

cp -r /var/www/shiyuan/frontend-vue/dist/* /var/www/shiyuan/frontend/dist/
cp -r /var/www/shiyuan/admin-vue/dist/*    /var/www/shiyuan/admin/dist/
```

---

## PM2 进程管理

在项目根目录创建 PM2 生态配置文件：

```bash
cat > /var/www/shiyuan/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'shiyuan-api',
      cwd: '/var/www/shiyuan/backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/shiyuan/api-error.log',
      out_file:   '/var/log/shiyuan/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
EOF
```

启动并持久化：

```bash
mkdir -p /var/log/shiyuan

cd /var/www/shiyuan
pm2 start ecosystem.config.js

# 保存进程列表，确保服务器重启后自动恢复
pm2 save
pm2 startup   # 按输出提示执行相应命令（复制粘贴运行）
```

常用 PM2 命令：

```bash
pm2 list                    # 查看所有进程
pm2 logs shiyuan-api        # 实时日志
pm2 restart shiyuan-api     # 重启
pm2 reload shiyuan-api      # 零停机热重载
pm2 stop shiyuan-api        # 停止
pm2 monit                   # 实时监控面板
```

---

## Nginx 配置

### 1. 复制配置文件

```bash
cp /var/www/shiyuan/deploy/nginx.conf /etc/nginx/sites-available/shiyuan
```

### 2. 修改域名

```bash
nano /etc/nginx/sites-available/shiyuan
```

将所有 `your-domain.com` 替换为实际域名（例如 `sy.example.com`），
将 `admin.your-domain.com` 替换为实际管理域名（例如 `admin.sy.example.com`）。

> **注意**：SSL 证书部分先保留占位符，等 Certbot 签发证书后会自动修改。

### 3. 临时去掉 SSL 块，先用 HTTP 验证

在申请证书之前，将 `listen 443 ssl` 改为 `listen 80`，并去掉所有 `ssl_*` 行，使 Nginx 能正常启动以通过 ACME 验证。

或者，直接先使用一个只监听 80 的临时配置：

```bash
cat > /etc/nginx/sites-available/shiyuan-temp << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    root /var/www/shiyuan/frontend/dist;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
server {
    listen 80;
    server_name admin.your-domain.com;
    root /var/www/shiyuan/admin/dist;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
EOF
ln -s /etc/nginx/sites-available/shiyuan-temp /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## SSL 证书

### 申请 Let's Encrypt 证书

```bash
# 同时签发用户域名和管理域名（各自独立证书）
certbot --nginx -d your-domain.com -d www.your-domain.com
certbot --nginx -d admin.your-domain.com
```

> Certbot 会自动修改 Nginx 配置并重新加载。

### 启用正式配置

```bash
# 删除临时配置，启用正式配置
rm /etc/nginx/sites-enabled/shiyuan-temp
ln -s /etc/nginx/sites-available/shiyuan /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 自动续期（Certbot 安装时已自动配置）

```bash
# 验证续期逻辑是否正常
certbot renew --dry-run
```

证书有效期 90 天，Certbot 会通过 systemd timer 自动续期。

---

## 首次初始化

### 1. 运行数据库种子脚本

种子脚本会创建默认 VIP 等级数据和初始管理员账号：

```bash
cd /var/www/shiyuan/backend
node scripts/seed.js
```

脚本输出示例：
```
✓ VIP levels seeded (5 levels)
✓ Admin user created: admin / admin123
```

### 2. 立即修改管理员密码

登录管理后台 `https://admin.your-domain.com`，使用默认凭据 `admin / admin123` 登录后，
前往 **账户设置** 立即修改密码。

**不修改默认密码即上线属于严重安全隐患。**

### 3. 配置 VIP 等级阈值

登录管理后台 → **VIP 管理** → **VIP 等级**，确认各等级的积分门槛和年度权益配置符合运营要求：

| 等级 | 门槛（积分/年） | 转让次数/年 | 回购次数/年 | 插队次数/年 |
|------|----------------|------------|------------|------------|
| VIP1 | 888 | 1 | 0 | 0 |
| VIP2 | 2688 | 2 | 1 | 0 |
| VIP3 | 5688 | 3 | 2 | 0 |
| VIP4 | 8888 | 5 | 3 | 3 |
| VIP5 | 16888 | 8 | 5 | 6 |

### 4. 验证邮件服务

在管理后台注册一个测试用户，确认验证邮件能正常发送和接收。

---

## 日常维护

### 代码更新部署

```bash
cd /var/www/shiyuan
git pull origin master

# 如有后端依赖更新
cd backend && npm install --production && cd ..

# 重建前端（如有前端代码更新）
cd frontend-vue && npm install && npm run build
cp -r dist/* /var/www/shiyuan/frontend/dist/
cd ../admin-vue && npm install && npm run build
cp -r dist/* /var/www/shiyuan/admin/dist/
cd ..

# 重启后端
pm2 reload shiyuan-api
```

### 年度 VIP 重置（每年年末执行）

VIP 年度重置包含两个操作，需在管理后台手动触发：

1. 登录管理后台 → **VIP 管理** → **VIP 等级** 页面
2. 点击 **重置年度消费** 按钮
   - 系统会根据用户过去一年的 `annual_spend` 重新计算 VIP 等级
   - 不达标的用户将自动降级，权益随之更新
   - 所有用户的 `annual_spend` 清零
3. 点击 **重置年度权益计数** 按钮
   - 重新按当前 VIP 等级发放当年的转让、回购、插队名额

> **执行顺序很重要**：必须先重置年度消费（含降级），再重置权益计数（按新等级发放）。

### 查看日志

```bash
# 实时 API 日志
pm2 logs shiyuan-api --lines 100

# 完整日志文件
tail -f /var/log/shiyuan/api-out.log
tail -f /var/log/shiyuan/api-error.log

# Nginx 访问日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 备份策略

### MongoDB 备份

```bash
# 手动备份
mongodump --db shiyuan --out /backup/mongo/$(date +%Y%m%d)

# 恢复
mongorestore --db shiyuan /backup/mongo/20240101/shiyuan
```

推荐配置 crontab 定时备份：

```bash
crontab -e
```

添加：

```cron
# 每天凌晨 3 点备份 MongoDB，保留最近 14 天
0 3 * * * mongodump --db shiyuan --out /backup/mongo/$(date +\%Y\%m\%d) && \
  find /backup/mongo -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
```

### 上传文件备份

```bash
# 同步到备份目录或远程存储
rsync -avz /var/www/shiyuan/backend/uploads/ /backup/uploads/
```

---

## 故障排查

### 后端无法启动

```bash
pm2 logs shiyuan-api --lines 50
# 常见原因：
# - .env 文件缺失或配置错误
# - MongoDB 未启动：systemctl status mongod
# - 端口被占用：lsof -i :3000
```

### 前端页面空白 / 404

```bash
# 检查构建产物是否存在
ls /var/www/shiyuan/frontend/dist/
ls /var/www/shiyuan/admin/dist/

# 检查 Nginx 配置
nginx -t
systemctl status nginx
```

### API 请求 502 Bad Gateway

```bash
# 确认后端进程在运行
pm2 list
curl http://127.0.0.1:3000/api/health

# 确认 Nginx 代理配置正确
grep -A5 "location /api" /etc/nginx/sites-available/shiyuan
```

### 邮件发送失败

```bash
# 检查 SMTP 配置
grep MAIL /var/www/shiyuan/backend/.env

# 测试 SMTP 连通性（替换实际地址和端口）
nc -zv smtp.example.com 465
```

### MongoDB 连接失败

```bash
systemctl status mongod
systemctl restart mongod

# 检查连接串
mongo mongodb://localhost:27017/shiyuan
# 或 mongosh
mongosh mongodb://localhost:27017/shiyuan
```

### SSL 证书问题

```bash
# 查看证书有效期
certbot certificates

# 手动续期
certbot renew --force-renewal
systemctl reload nginx
```

### 防火墙检查

```bash
# 确保 80、443 端口对外开放
ufw status
ufw allow 80
ufw allow 443
ufw reload
```

---

## 快速部署清单

- [ ] 系统更新完成
- [ ] Node.js / MongoDB / Nginx / PM2 / Certbot 已安装
- [ ] 代码已克隆到 `/var/www/shiyuan`
- [ ] `backend/.env` 已配置（JWT 密钥、MongoDB URI、邮件服务、CORS_ORIGIN）
- [ ] 上传目录已创建（`backend/uploads/`）
- [ ] 前端依赖已安装并构建完成
- [ ] 管理后台依赖已安装并构建完成
- [ ] 构建产物已复制到 Nginx root 目录
- [ ] PM2 进程已启动并持久化（`pm2 save && pm2 startup`）
- [ ] Nginx 配置已部署并测试通过（`nginx -t`）
- [ ] SSL 证书已签发（`certbot --nginx`）
- [ ] 数据库种子脚本已运行（`node scripts/seed.js`）
- [ ] 管理员默认密码已修改
- [ ] VIP 等级数据已核对
- [ ] 邮件发送已测试
- [ ] 防火墙规则已配置（80 / 443 开放，3000 仅本地访问）
