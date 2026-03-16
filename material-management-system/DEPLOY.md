# 诸城叙梦素材管理平台 — 生产部署文档

## 目录

1. [系统架构](#系统架构)
2. [服务器要求](#服务器要求)
3. [软件安装](#软件安装)
4. [代码部署](#代码部署)
5. [后端配置](#后端配置)
6. [MongoDB 副本集](#mongodb-副本集)
7. [构建前端](#构建前端)
8. [PM2 进程管理](#pm2-进程管理)
9. [Nginx 与 SSL](#nginx-与-ssl)
10. [首次初始化](#首次初始化)
11. [验证部署](#验证部署)
12. [日常维护](#日常维护)
13. [备份与恢复](#备份与恢复)
14. [故障排查](#故障排查)

---

## 系统架构

```
                          ┌──────────────┐
  用户浏览器 ───────────▶│    Nginx     │
                          │  (80→443)    │
                          └──────┬───────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
            ▼                    ▼                    ▼
   /var/www/shiyuan/      /var/www/shiyuan/     http://127.0.0.1:3000
   frontend-vue/dist      admin-vue/dist             │
   (用户前台 SPA)         (管理后台 SPA)              ▼
                                              ┌──────────────┐
                                              │  Node.js     │
                                              │  Express API │
                                              └──────┬───────┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │  MongoDB     │
                                              │  (副本集)    │
                                              └──────────────┘
```

| 子系统 | 源码目录 | 运行方式 | 说明 |
|--------|----------|----------|------|
| API 后端 | `backend/` | PM2 → Node.js :3000 | Express + Mongoose |
| 用户前台 | `frontend-vue/` | Nginx 静态文件 | Vue 3 + Vite，构建产物 `dist/` |
| 管理后台 | `admin-vue/` | Nginx 静态文件 | Vue 3 + Vite，构建产物 `dist/` |

> **重要**：系统在购买、转让、赞助、回购等操作中使用了 **Mongoose 事务**（多文档原子操作），因此 MongoDB **必须以副本集模式运行**，即使只有一台服务器也需要配置单节点副本集。

---

## 服务器要求

### 硬件

| 资源 | 最低 | 推荐 | 说明 |
|------|------|------|------|
| CPU | 2 核 | 4 核 | 并发用户多时提升响应 |
| 内存 | 2 GB | 4 GB | Node.js + MongoDB 共用 |
| 系统盘 | 20 GB SSD | 40 GB SSD | OS + 应用代码 + 日志 |
| 数据盘 | 50 GB | 200 GB+ | MongoDB 数据 + 上传素材 |
| 带宽 | 5 Mbps | 20 Mbps | 用户数量决定 |

### 软件

| 软件 | 要求版本 | 用途 |
|------|----------|------|
| Ubuntu | 22.04 LTS | 操作系统 |
| Node.js | 20.x LTS | 后端运行时 + 前端构建 |
| MongoDB | 7.x | 数据库（必须副本集模式） |
| Nginx | 1.25+ | 反向代理 + 静态文件 |
| PM2 | 最新 | Node 进程管理 |
| Certbot | 最新 | Let's Encrypt SSL |
| Git | 任意 | 代码管理 |

---

## 软件安装

> 以 root 用户执行，普通用户请加 `sudo`。

### 1. 系统基础

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential
```

### 2. Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v  # v20.x.x
```

### 3. MongoDB 7.x

```bash
# 导入 GPG 密钥
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

# 添加源
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  > /etc/apt/sources.list.d/mongodb-org-7.0.list

apt update && apt install -y mongodb-org
```

> **先不要启动 mongod**，需要先配置副本集（见下文）。

### 4. Nginx

```bash
# 使用 Nginx 官方源获取最新稳定版（≥ 1.25，支持 http2 on 指令）
curl -fsSL https://nginx.org/keys/nginx_signing.key | \
  gpg --dearmor -o /usr/share/keyrings/nginx-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] \
  http://nginx.org/packages/ubuntu jammy nginx" \
  > /etc/apt/sources.list.d/nginx.list

apt update && apt install -y nginx
systemctl enable nginx
```

### 5. PM2 + Certbot

```bash
npm install -g pm2
apt install -y certbot python3-certbot-nginx
```

---

## 代码部署

```bash
mkdir -p /var/www/shiyuan
cd /var/www/shiyuan

git clone https://github.com/Junjun7/shiyuan-website.git .
```

验证目录结构：

```bash
ls
# 应包含：backend/  frontend-vue/  admin-vue/  deploy/  DEPLOY.md  ...
```

---

## 后端配置

### 1. 安装依赖

```bash
cd /var/www/shiyuan/backend
npm install --omit=dev
```

### 2. 环境变量

```bash
cp .env.example .env
nano .env
```

逐项配置：

```dotenv
NODE_ENV=production
PORT=3000

# ──────── MongoDB ────────
# 副本集连接串（注意 ?replicaSet=rs0）
MONGODB_URI=mongodb://localhost:27017/shiyuan?replicaSet=rs0

# ──────── JWT 密钥（必须修改！） ────────
# 生成命令：node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=<粘贴64位随机字符串>
JWT_REFRESH_SECRET=<粘贴另一个64位随机字符串>

# ──────── 文件上传 ────────
UPLOAD_DIR=uploads

# ──────── CORS ────────
# 替换为实际域名，逗号分隔
CORS_ORIGIN=https://your-domain.com,https://admin.your-domain.com

# ──────── 日志 ────────
LOG_LEVEL=info

# ──────── 邮件（SMTP） ────────
MAIL_HOST=smtp.example.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=noreply@example.com
MAIL_PASS=<邮箱授权码>
MAIL_FROM="诸城叙梦" <noreply@example.com>
```

### 3. 创建上传目录

```bash
mkdir -p /var/www/shiyuan/backend/uploads
```

---

## MongoDB 副本集

本系统的购买、转让、赞助、回购、回滚等操作使用 Mongoose 多文档事务，**要求 MongoDB 运行在副本集模式下**。即使只有一台服务器，也必须配置单节点副本集。

### 配置步骤

**1. 编辑 MongoDB 配置文件：**

```bash
nano /etc/mongod.conf
```

找到 `#replication:` 一行，取消注释并添加：

```yaml
replication:
  replSetName: "rs0"
```

确认 `bindIp` 包含 `127.0.0.1`（单机部署只需本地访问）：

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
```

**2. 启动 MongoDB：**

```bash
systemctl start mongod
systemctl enable mongod
```

**3. 初始化副本集：**

```bash
mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
```

**4. 验证副本集状态：**

```bash
mongosh --eval 'rs.status().ok'
# 输出应为 1
```

> 如果跳过此步骤，所有涉及事务的接口（购买、转让、赞助、回购、回滚）都会返回 500 错误。

### （可选）启用 MongoDB 认证

生产环境建议开启认证：

```bash
mongosh
```

```javascript
use admin
db.createUser({
  user: "shiyuan",
  pwd: "your_strong_password",
  roles: [{ role: "readWrite", db: "shiyuan" }]
})
```

然后在 `/etc/mongod.conf` 中添加：

```yaml
security:
  authorization: enabled
```

重启 mongod 并更新 `.env` 连接串：

```dotenv
MONGODB_URI=mongodb://shiyuan:your_strong_password@localhost:27017/shiyuan?replicaSet=rs0&authSource=admin
```

---

## 构建前端

```bash
# 用户前台
cd /var/www/shiyuan/frontend-vue
npm install
npm run build

# 管理后台
cd /var/www/shiyuan/admin-vue
npm install
npm run build
```

构建产物分别位于 `frontend-vue/dist/` 和 `admin-vue/dist/`，Nginx 直接指向这两个目录，无需额外复制。

---

## PM2 进程管理

### 1. 创建日志目录

```bash
mkdir -p /var/log/shiyuan
```

### 2. 启动后端

```bash
cd /var/www/shiyuan/backend
pm2 start server.js \
  --name shiyuan-api \
  --max-memory-restart 512M \
  --log-date-format "YYYY-MM-DD HH:mm:ss" \
  -e /var/log/shiyuan/api-error.log \
  -o /var/log/shiyuan/api-out.log
```

### 3. 持久化

```bash
pm2 save
pm2 startup
# ↑ 会输出一条 sudo 命令，复制粘贴执行
```

### 4. 配置日志轮转

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

### 常用命令

```bash
pm2 list                    # 查看进程
pm2 logs shiyuan-api        # 实时日志
pm2 reload shiyuan-api      # 零停机重载
pm2 monit                   # 监控面板
```

---

## Nginx 与 SSL

### 1. 部署 Nginx 配置

```bash
# 移除默认站点
rm -f /etc/nginx/sites-enabled/default 2>/dev/null
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null

# 复制项目配置
cp /var/www/shiyuan/deploy/nginx.conf /etc/nginx/conf.d/shiyuan.conf
```

### 2. 修改域名

```bash
# 全局替换域名（将 your-domain.com 替换为实际域名）
sed -i 's/your-domain.com/实际域名/g' /etc/nginx/conf.d/shiyuan.conf
sed -i 's/admin\.实际域名/admin.实际域名/g' /etc/nginx/conf.d/shiyuan.conf
```

> 手动确认：`nano /etc/nginx/conf.d/shiyuan.conf`

### 3. 修改 Nginx 中的静态文件路径

配置文件中 Nginx root 指向：

```
/var/www/shiyuan/frontend-vue/dist    # 用户前台
/var/www/shiyuan/admin-vue/dist       # 管理后台
```

如果部署路径不同，请相应修改。

### 4. 先用 HTTP 启动（申请证书前）

SSL 证书尚未申请，需临时改为 HTTP：

```bash
# 备份正式配置
cp /etc/nginx/conf.d/shiyuan.conf /etc/nginx/conf.d/shiyuan.conf.bak

# 写入临时 HTTP 配置
cat > /etc/nginx/conf.d/shiyuan.conf << 'CONF'
server {
    listen 80;
    server_name 实际域名 www.实际域名;
    root /var/www/shiyuan/frontend-vue/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /uploads/ {
        alias /var/www/shiyuan/backend/uploads/;
    }
}
server {
    listen 80;
    server_name admin.实际域名;
    root /var/www/shiyuan/admin-vue/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
CONF

nginx -t && systemctl start nginx
```

### 5. 申请 SSL 证书

确保 DNS 已将域名解析到服务器 IP，然后：

```bash
certbot --nginx -d 实际域名 -d www.实际域名
certbot --nginx -d admin.实际域名
```

Certbot 会自动修改 Nginx 配置添加 SSL 相关指令。

### 6. 恢复正式配置（推荐）

Certbot 修改后的配置已可使用。如果你希望使用项目提供的完整配置（含安全头、缓存策略等）：

```bash
# 恢复备份的正式配置
cp /etc/nginx/conf.d/shiyuan.conf.bak /etc/nginx/conf.d/shiyuan.conf

# 手动将 Certbot 生成的证书路径填入配置中的 ssl_certificate / ssl_certificate_key
# 证书路径通常为：
#   /etc/letsencrypt/live/实际域名/fullchain.pem
#   /etc/letsencrypt/live/实际域名/privkey.pem

nginx -t && systemctl reload nginx
```

### 7. 验证自动续期

```bash
certbot renew --dry-run
```

---

## 首次初始化

### 1. 运行种子脚本

种子脚本会创建 VIP 等级和默认管理员账号：

```bash
cd /var/www/shiyuan/backend
node scripts/seed.js
```

### 2. 立即修改管理员密码

登录管理后台 `https://admin.实际域名`，使用默认凭据登录：

| 用户名 | 密码 |
|--------|------|
| admin | admin123 |

**登录后立即修改密码。不修改默认密码即上线属于严重安全隐患。**

### 3. 确认 VIP 等级

登录管理后台 → **VIP 管理** → **VIP 等级**，确认种子数据：

| 等级 | 年度积分门槛 | 回购/年 | 转让/年 | 插队/年 | 优先购 |
|------|------------|---------|---------|---------|--------|
| VIP1 | 888 | 1 | 0 | 0 | 是 |
| VIP2 | 2,688 | 1 | 1 | 0 | 是 |
| VIP3 | 5,688 | 2 | 2 | 0 | 是 |
| VIP4 | 8,888 | 2 | 3 | 3 | 是 |
| VIP5 | 16,888 | 3 | 6 | 6 | 是 |

如需调整，可在管理后台直接修改。

### 4. 测试邮件发送

注册一个测试用户 → 绑定邮箱 → 确认收到验证码邮件。

---

## 验证部署

逐项检查，确保系统各部分正常工作：

```bash
# 1. MongoDB 副本集
mongosh --eval 'rs.status().ok'              # 应输出 1

# 2. 后端 API
curl -s http://127.0.0.1:3000/api/health | python3 -m json.tool
# 应显示 {"status": "ok", "db": "connected", ...}

# 3. 前端构建产物
ls /var/www/shiyuan/frontend-vue/dist/index.html   # 应存在
ls /var/www/shiyuan/admin-vue/dist/index.html      # 应存在

# 4. Nginx
nginx -t                                     # 应显示 syntax is ok
curl -I https://实际域名                      # 应返回 200
curl -I https://admin.实际域名                # 应返回 200

# 5. API 通过 Nginx 代理
curl -s https://实际域名/api/health | python3 -m json.tool

# 6. PM2 进程
pm2 list                                     # shiyuan-api 状态应为 online

# 7. SSL 证书
certbot certificates                         # 应显示有效证书
```

---

## 日常维护

### 代码更新

```bash
cd /var/www/shiyuan
git pull origin master

# 后端
cd backend && npm install --omit=dev && cd ..
pm2 reload shiyuan-api

# 前端（仅在前端代码有变更时）
cd frontend-vue && npm install && npm run build && cd ..
cd admin-vue && npm install && npm run build && cd ..
```

> 前端构建产物更新后 Nginx 无需重载（直接读取新文件）。

### 年度 VIP 重置

每年年末执行一次，操作入口在管理后台 → **VIP 管理** → **VIP 顾客**。

**必须按以下顺序执行：**

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 点击「重置年度消费」 | 根据 annual_spend 重新计算 VIP 等级，不达标者降级，然后清零 annual_spend |
| 2 | 点击「重置年度权益计数」 | 按降级后的新等级重新发放转让/回购/插队次数 |

> 顺序不可颠倒。先降级（步骤 1），再按新等级发放配额（步骤 2）。

### 查看日志

```bash
pm2 logs shiyuan-api --lines 200       # API 实时日志
tail -f /var/log/nginx/access.log      # Nginx 访问日志
tail -f /var/log/nginx/error.log       # Nginx 错误日志
```

---

## 备份与恢复

### MongoDB 备份

```bash
# 手动备份
mongodump --db shiyuan --out /backup/mongo/$(date +%Y%m%d)

# 恢复
mongorestore --db shiyuan --drop /backup/mongo/20260101/shiyuan
```

### 定时自动备份（推荐）

```bash
mkdir -p /backup/mongo
crontab -e
```

添加：

```cron
# 每天凌晨 3:00 备份 MongoDB，保留最近 14 天
0 3 * * * mongodump --db shiyuan --out /backup/mongo/$(date +\%Y\%m\%d) && find /backup/mongo -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null
```

### 上传文件备份

```bash
# 同步到备份目录
rsync -avz /var/www/shiyuan/backend/uploads/ /backup/uploads/

# 或加入 crontab
0 4 * * * rsync -avz /var/www/shiyuan/backend/uploads/ /backup/uploads/
```

---

## 故障排查

### 后端启动失败

```bash
pm2 logs shiyuan-api --lines 50
```

| 错误信息 | 原因 | 解决 |
|----------|------|------|
| `MongoServerError: not primary` | MongoDB 副本集未初始化 | 执行 `mongosh --eval 'rs.initiate(...)'` |
| `MongooseError: ...transaction...` | 同上 | 确认副本集正常 `rs.status()` |
| `ECONNREFUSED 127.0.0.1:27017` | MongoDB 未启动 | `systemctl start mongod` |
| `EADDRINUSE :::3000` | 端口被占用 | `lsof -i :3000`，kill 占用进程 |
| `JWT_SECRET` 相关 | .env 未配置 | 检查 `.env` 文件 |

### 前端页面空白

```bash
ls /var/www/shiyuan/frontend-vue/dist/index.html   # 确认构建产物存在
nginx -t                                            # 确认 Nginx 配置无语法错误
systemctl status nginx                              # 确认 Nginx 正在运行
```

### API 502 Bad Gateway

```bash
pm2 list                                   # 确认 shiyuan-api 状态为 online
curl http://127.0.0.1:3000/api/health      # 直连后端测试
```

### 事务操作返回 500

几乎 100% 是 MongoDB 副本集问题：

```bash
mongosh --eval 'rs.status()'
# 检查 members 中是否有 PRIMARY
# 如果无 PRIMARY，重新初始化副本集
```

### 邮件发送失败

```bash
# 检查 SMTP 配置
grep MAIL /var/www/shiyuan/backend/.env

# 测试连通性
nc -zv smtp.example.com 465
# 或
openssl s_client -connect smtp.example.com:465
```

### SSL 证书过期

```bash
certbot certificates                  # 查看有效期
certbot renew                         # 手动续期
systemctl reload nginx
```

### 防火墙

```bash
ufw status
ufw allow 80/tcp
ufw allow 443/tcp
# 3000 端口不要对外开放，仅本地 Nginx 代理访问
ufw reload
```

---

## 快速部署清单

```
[ ] 系统更新、基础工具安装
[ ] Node.js 20.x 安装
[ ] MongoDB 7.x 安装
[ ] MongoDB 副本集配置并初始化（rs.initiate）
[ ] （可选）MongoDB 认证配置
[ ] Nginx 1.25+ 安装
[ ] PM2 + Certbot 安装
[ ] 代码 clone 到 /var/www/shiyuan
[ ] backend/.env 配置完成（JWT 密钥、MongoDB URI、邮件、CORS）
[ ] backend 依赖安装（npm install --omit=dev）
[ ] uploads 目录创建
[ ] frontend-vue 构建完成（npm run build）
[ ] admin-vue 构建完成（npm run build）
[ ] PM2 启动后端并持久化（pm2 save && pm2 startup）
[ ] PM2 日志轮转配置
[ ] Nginx 配置部署、域名修改
[ ] SSL 证书申请（certbot --nginx）
[ ] certbot renew --dry-run 验证自动续期
[ ] 种子脚本执行（node scripts/seed.js）
[ ] 管理员默认密码已修改
[ ] VIP 等级数据核对
[ ] 邮件发送测试
[ ] 健康检查通过（/api/health）
[ ] 防火墙配置（80/443 开放，3000 不对外）
[ ] 定时备份 crontab 配置
```
