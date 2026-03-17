#!/bin/bash
#
# 诸城叙梦素材管理平台 — 一键部署脚本
# 适用于：Ubuntu 22.04 LTS 全新服务器
# 用法：以 root 身份执行  bash install.sh
#
set -e

# ============================================================
# 配置区域 — 按需修改
# ============================================================
DEPLOY_DIR="/var/www/shiyuan"
GIT_REPO="https://github.com/cnqiujunhu-dev/shiyuan-website.git"
# 仓库克隆后，项目实际在子目录 material-management-system 下
PROJECT_DIR="$DEPLOY_DIR/material-management-system"
SERVER_IP="120.27.205.91"
# 无域名时用 IP 访问；有域名后改为实际域名并取消 SSL 部分的注释
DOMAIN="$SERVER_IP"
ADMIN_DOMAIN="$SERVER_IP"
# 如果有域名，取消下面两行并注释上面两行：
# DOMAIN="your-domain.com"
# ADMIN_DOMAIN="admin.your-domain.com"

echo "========================================"
echo "  诸城叙梦 — 开始一键部署"
echo "========================================"

# ============================================================
# 1. 系统更新 + 基础工具
# ============================================================
echo "[1/10] 系统更新..."
apt update && apt upgrade -y
apt install -y curl git build-essential

# ============================================================
# 2. 安装 Node.js 20.x
# ============================================================
echo "[2/10] 安装 Node.js..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "  Node: $(node -v)  npm: $(npm -v)"

# ============================================================
# 3. 安装 MongoDB 7.x
# ============================================================
echo "[3/10] 安装 MongoDB..."
if ! command -v mongod &>/dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
    # 自动检测 Ubuntu 版本代号
    UBUNTU_CODENAME=$(lsb_release -cs 2>/dev/null || echo "jammy")
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
        https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" \
        > /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt update && apt install -y mongodb-org
fi

# 配置副本集（事务必需）
if ! grep -q "replSetName" /etc/mongod.conf; then
    echo "[3/10] 配置 MongoDB 副本集..."
    sed -i 's/^#replication:/replication:\n  replSetName: "rs0"/' /etc/mongod.conf
    # 如果上面 sed 没生效（没有 #replication: 行），追加配置
    if ! grep -q "replSetName" /etc/mongod.conf; then
        echo -e "\nreplication:\n  replSetName: \"rs0\"" >> /etc/mongod.conf
    fi
fi

systemctl start mongod
systemctl enable mongod
sleep 2

# 初始化副本集（幂等操作）
echo "[3/10] 初始化 MongoDB 副本集..."
mongosh --quiet --eval '
    try { rs.status().ok } catch(e) {
        rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] });
        print("副本集已初始化");
    }
' || true
sleep 3

# 验证
RS_OK=$(mongosh --quiet --eval 'rs.status().ok' 2>/dev/null || echo "0")
if [ "$RS_OK" != "1" ]; then
    echo "  [警告] 副本集状态异常，等待 10 秒后重试..."
    sleep 10
    RS_OK=$(mongosh --quiet --eval 'rs.status().ok' 2>/dev/null || echo "0")
fi
echo "  MongoDB 副本集状态: $RS_OK (1=正常)"

# ============================================================
# 4. 安装 Nginx
# ============================================================
echo "[4/10] 安装 Nginx..."
if ! command -v nginx &>/dev/null; then
    apt install -y nginx
fi
systemctl enable nginx

# ============================================================
# 5. 安装 PM2
# ============================================================
echo "[5/10] 安装 PM2..."
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
fi

# ============================================================
# 6. 克隆代码
# ============================================================
echo "[6/10] 部署代码..."
if [ -d "$PROJECT_DIR/backend" ] && [ -d "$PROJECT_DIR/frontend-vue" ]; then
    echo "  代码已通过 scp 上传，跳过 git clone"
    cd "$DEPLOY_DIR"
else
    mkdir -p "$DEPLOY_DIR"
    if [ -d "$DEPLOY_DIR/.git" ]; then
        cd "$DEPLOY_DIR"
        git pull origin master || git pull "https://ghfast.top/$GIT_REPO" master
    else
        git clone "$GIT_REPO" "$DEPLOY_DIR" || \
            git clone "https://ghfast.top/$GIT_REPO" "$DEPLOY_DIR"
        cd "$DEPLOY_DIR"
    fi
fi

# ============================================================
# 7. 配置后端
# ============================================================
echo "[7/10] 配置后端..."
cd "$PROJECT_DIR/backend"
npm install --omit=dev

mkdir -p uploads

# 生成 .env（如不存在）
if [ ! -f .env ]; then
    JWT1=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
    JWT2=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
    cat > .env << ENVEOF
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://localhost:27017/shiyuan?replicaSet=rs0
JWT_SECRET=${JWT1}
JWT_REFRESH_SECRET=${JWT2}
UPLOAD_DIR=uploads
CORS_ORIGIN=http://${SERVER_IP},http://${SERVER_IP}:8080
LOG_LEVEL=info
# 邮件配置（按需填写，暂时留空不影响启动）
MAIL_HOST=
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=
MAIL_PASS=
MAIL_FROM=
ENVEOF
    echo "  .env 已生成（JWT 密钥已自动生成）"
else
    echo "  .env 已存在，跳过"
fi

# ============================================================
# 8. 构建前端
# ============================================================
echo "[8/10] 构建用户前台..."
cd "$PROJECT_DIR/frontend-vue"
npm install
npm run build

echo "[8/10] 构建管理后台..."
cd "$PROJECT_DIR/admin-vue"
npm install
npm run build

# ============================================================
# 9. 启动后端
# ============================================================
echo "[9/10] 启动 API 服务..."
mkdir -p /var/log/shiyuan

# 停掉旧进程（如有）
pm2 delete shiyuan-api 2>/dev/null || true

cd "$PROJECT_DIR/backend"
pm2 start server.js \
    --name shiyuan-api \
    --max-memory-restart 400M \
    --log-date-format "YYYY-MM-DD HH:mm:ss" \
    -e /var/log/shiyuan/api-error.log \
    -o /var/log/shiyuan/api-out.log

pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# 运行种子脚本
echo "  运行数据库种子脚本..."
sleep 2
cd "$PROJECT_DIR/backend"
node scripts/seed.js

# ============================================================
# 10. 配置 Nginx
# ============================================================
echo "[10/10] 配置 Nginx..."

# 移除默认站点
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

# 用户前台：80 端口
cat > /etc/nginx/conf.d/shiyuan-frontend.conf << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    root /var/www/shiyuan/material-management-system/frontend-vue/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50m;
    }

    location /uploads/ {
        alias /var/www/shiyuan/material-management-system/backend/uploads/;
        expires 7d;
    }

    location ~ /\. { deny all; }
}
NGINXEOF

# 管理后台：8080 端口
cat > /etc/nginx/conf.d/shiyuan-admin.conf << 'NGINXEOF'
server {
    listen 8080;
    server_name _;

    root /var/www/shiyuan/material-management-system/admin-vue/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50m;
    }

    location /uploads/ {
        alias /var/www/shiyuan/material-management-system/backend/uploads/;
        expires 7d;
    }

    location ~ /\. { deny all; }
}
NGINXEOF

nginx -t && systemctl reload nginx

# ============================================================
# 防火墙
# ============================================================
if command -v ufw &>/dev/null; then
    ufw allow 80/tcp
    ufw allow 8080/tcp
    ufw allow 22/tcp
    echo "y" | ufw enable 2>/dev/null || true
fi

# ============================================================
# 完成
# ============================================================
echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "  用户前台:  http://${SERVER_IP}"
echo "  管理后台:  http://${SERVER_IP}:8080"
echo ""
echo "  管理员账号: admin"
echo "  管理员密码: admin123"
echo ""
echo "  ⚠ 请立即登录管理后台修改默认密码！"
echo ""
echo "  健康检查:"
echo "    curl http://127.0.0.1:3000/api/health"
echo ""
echo "  查看日志:"
echo "    pm2 logs shiyuan-api"
echo ""

# 健康检查
sleep 2
echo "--- API 健康检查 ---"
curl -s http://127.0.0.1:3000/api/health 2>/dev/null || echo "(API 尚在启动中，请稍后手动检查)"
echo ""
