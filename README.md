# 诸城叙梦素材管理平台

> 文档版本：V2.0 | 更新日期：2026-03-16

**诸城叙梦素材管理平台**是面向创作圈的素材购买、赞助、授权转让全流程管理系统。覆盖积分沉淀、VIP 等级权益、平台信息管理及管理员后台批量运营等核心场景。

---

## 目录

1. [项目概述](#1-项目概述)
2. [术语与业务定义](#2-术语与业务定义)
3. [角色与权限](#3-角色与权限)
4. [功能模块——用户端](#4-功能模块用户端)
5. [功能模块——管理端](#5-功能模块管理端)
6. [数据模型](#6-数据模型)
7. [API 规格](#7-api-规格)
8. [VIP 等级与权益](#8-vip-等级与权益)
9. [核心业务规则](#9-核心业务规则)
10. [技术栈与架构](#10-技术栈与架构)
11. [目录结构](#11-目录结构)
12. [本地开发](#12-本地开发)
13. [部署指南](#13-部署指南)
14. [当前版本（V0）说明](#14-当前版本v0说明)

---

## 1. 项目概述

### 1.1 项目目标

- 覆盖素材**购买 / 赞助 / 转让 / 接转**全流程，沉淀积分与 VIP 权益。
- 提供仅网页注册的低门槛账号体系；支持邮箱绑定与验证码找回密码。
- 支持平台信息（易次元 / 橙光 / 闪艺）作为可选字段，后续可申请变更与审核。
- 管理员后台支持商品 / 交易 / VIP 批量导入、查询与修订，具备审计与导出能力。

### 1.2 关键业务约束

| 约束 | 说明 |
|------|------|
| 店铺消费口径 | 25 年 4 月后登记的定制 / 合订 / 官车 / 授权计入；私车及未报备的不计入 |
| 26 年后定制 | 进行中须及时报备计入消费；已结束的补登记无效 |
| 老 VIP | 保留原有等级；若某自然年消费为 0，次年降级（首年统计截至 2026/12/31） |
| 系统内转让 | 仅限 25 年 4 月后购买的授权；此前授权须退圈线下转让 |
| 自印报备 | 份数不超过 30 次；须经后台审核通过 |

---

## 2. 术语与业务定义

| 术语 | 说明 |
|------|------|
| **购买-自用** | 用户直接购买素材并自己使用；有发货链接；积分 +价格 |
| **购买-赞助** | 用户为他人购买（赞助）某素材；无发货链接；积分 +价格 |
| **被赞助** | 某用户收到了他人为其购买的素材；有发货链接；积分 +0 |
| **转出** | VIP 用户将已购授权转让给他人；无发货链接；原条目替换；动态显示 -积分 |
| **转入** | 接受他人转让的素材；有发货链接；积分 +价格 |
| **积分** | 近似价格的加减分，用于 VIP 等级判定；与年度消费口径不同 |
| **年度消费** | 截至 2026/12/31 的「购买类」积分合计，用于 VIP 降级判定 |
| **发货链接** | 素材交付链接，仅自用 / 转入 / 被赞助可见 |
| **平台更换** | 一年一次，仅修改平台字段（易次元 / 橙光 / 闪艺），ID / QQ 不变 |

---

## 3. 角色与权限

| 角色 | 能力概览 |
|------|---------|
| **访客** | 网页注册 / 登录；可浏览在售商品（可选配置） |
| **普通用户** | 用户名+密码登录；可选绑定邮箱；管理我的素材；赞助；查看动态与年度消费；申请平台更换、自印报备 |
| **VIP 用户** | 在普通用户基础上拥有「转让」能力（次数受等级限制），查看剩余次数 |
| **管理员（店长/副店）** | 商品/交易/VIP 批量导入；查询与修订授权/用户/VIP；重置次数与清零年度消费；导出与审计 |
| **审核员（运营）** | 审批平台更换与自印报备；处理异常/争议 |

---

## 4. 功能模块——用户端

### 4.1 注册与登录

- **仅网页注册**：注册字段 `username`（唯一）、`password`、`email`（可选）。
- **登录方式**：`username + password`。
- **邮箱绑定（可选）**：完成邮箱验证后，允许「忘记密码 → 邮箱验证码 → 重置密码」。
- **风险提示**：未绑定邮箱的用户遗忘密码将无法自助找回，只能管理员人工重置（需严格核验）。

### 4.2 首页与导航

- 欢迎语：显示「欢迎回来 · `{username}`」。
- 一级导航：**我的素材** | **我的帮助** | **店铺授权** | **VIP 权益**；当前标签高亮。

### 4.3 账户动态（时间线/流水）

展示事件类型：购买（自用/赞助）、被赞助、转出、转入。

**样式规则**：
- 购买-赞助、转出 → 红色框
- 其余 → 浅色框

**字段**：事件类型、素材信息、积分变化、时间、对象用户、发货链接（若有）

**积分规则汇总**：

| 类型 | 积分变化 | 发货链接 |
|------|---------|---------|
| 购买-自用 | +价格 | ✅ 有 |
| 购买-赞助 | +价格 | ❌ 无 |
| 被赞助 | +0 | ✅ 有 |
| 转出 | 0（动态显示 -积分） | ❌ 无 |
| 转入 | +价格 | ✅ 有 |

### 4.4 年度消费

- 口径：截至 2026/12/31 的「购买类」积分合计。
- 展示：年度累计金额、起止时间、降级提醒。

### 4.5 我的素材

**每条素材信息包含**：

| 字段 | 说明 |
|------|------|
| 预览图 | JPG 格式 |
| 名称 | 商品名称 |
| 画师 | 创作者 |
| 题材 | 立绘 / 通加 / 场景 / CG / 素材 / 美工 / 音乐 |
| 价格 | 原始价格 |
| 获取类型 | 自用 / 转让与接转 / 被赞助 |
| 积分 | 此条记录贡献的积分 |
| 购买时间 | 交易发生时间 |
| 发货链接 | 仅自用 / 转入 / 被赞助可见 |
| 操作 | 转让（VIP 专属）；购买-赞助显示「确认赞助」 |

**筛选条件**：题材、画师、类型
**排序**：按变更时间倒序
**清单内容**与账户动态同步

**顶部信息栏**：
```
用户：{username}（平台）{ID}
剩余可转让次数：{N}（VIP 专属）
累计积分：{总积分}
```

### 4.6 我的帮助

**（一）更换平台**
- 平台范围：易次元、橙光、闪艺
- 每年仅可变更一次；仅更换平台字段，ID / QQ 不变
- 提交后进入后台审核，审核通过后生效

**（二）自印报备**

针对「立绘」：
1. 选择我的素材中已有的立绘
2. 选择二创延申类型：美工 / Q 版 / CG / 无
3. 若选「无」以外：联动填写二创作者 ID / QQ
4. 填写自印份数（≤ 30）、用途（文本输入）
5. 提交 → 进入后台审核

针对「场景 / CG」：选择二创延申：美工 / 无，其余同上。

### 4.7 VIP 权益

- 根据累计积分自动识别 VIP1~VIP5
- 展示：当前等级、剩余转让次数、剩余回购次数、累计积分、年度消费

### 4.8 店铺授权

- 展示在售授权列表、基本商品信息及购买入口（可选配置）

---

## 5. 功能模块——管理端

### 5.1 商品管理（定量信息）

上传/维护商品基础信息：

| 字段 | 类型 | 说明 |
|------|------|------|
| 预览图 | JPG | 商品展示图 |
| 名称 | 文本 | 手动输入 |
| 画师 | 文本 | 手动输入 |
| 题材 | 枚举多选 | 立绘/通加/场景/CG/素材/美工/音乐 |
| 价格 | 数字 | 手动输入 |
| 发货链接 | 文本 | 可为空；在对应条件下展示给用户 |

### 5.2 交易导入（变量信息）

批量导入购买记录，CSV 格式：

```
date, item_name/id, type(self/sponsor), actor_platform?, actor_id?, actor_qq?,
target_platform?, target_id?, target_qq?
```

- `type = self`：自用，无需目标用户信息
- `type = sponsor`：赞助，需填写被赞助人平台 / ID / QQ

### 5.3 VIP 导入

支持通过 `email` 或 `QQ` 键入，为老 VIP 回填等级与积分：

```
email?, qq?, vip_level, points
```

### 5.4 查询与修改

| 功能 | 说明 |
|------|------|
| 商品信息 | 查看/修改商品字段，含发货链接 |
| 商品授权顾客 | 查看单商品所有授权持有人（含转让后变动） |
| 用户信息 | 查看/修改已注册用户（平台 ID 纠错等） |
| VIP 等级配置 | 修改各等级门槛/次数；新增 VIP6/VIP7 等 |
| VIP 顾客清单 | 按等级筛选；可一键清零年度消费（27 年使用）；根据等级一键重置转让/回购次数；年度消费为 0 时手动降级 |

**VIP 顾客清单字段**：平台 / ID / QQ / VIP 等级 / 积分 / 年度消费 / 转让剩余次数 / 回购剩余次数

### 5.5 转让信息查询

查看全量转让记录，字段：时间、转让人（VIP 等级 / 平台 / ID / QQ）、接转人（平台 / ID / QQ）；支持导出与异常回滚。

### 5.6 审核中心

- 平台更换申请审批
- 自印报备审批
- 异常 / 争议处理

---

## 6. 数据模型

### users（用户）

```js
{
  _id,
  username,           // 唯一
  password_hash,
  email,              // 可选，唯一
  email_verified_at,  // 邮箱验证时间
  qq,                 // 可选
  platform,           // 易次元 | 橙光 | 闪艺（可选）
  platform_id,        // 平台 ID（可选）
  roles,              // ['user'] | ['user','vip'] | ['admin'] | ['reviewer']
  vip_level,          // 0~5
  points_total,       // 累计积分
  annual_spend,       // 年度消费（截至 2026/12/31）
  transfer_remaining, // 剩余转让次数
  buyback_remaining,  // 剩余回购次数
  created_at,
  updated_at
}
```

### items（商品）

```js
{
  _id,
  name,
  artist,
  categories,      // ['立绘','通加','场景','CG','素材','美工','音乐'] 多选
  price,
  preview_url,     // JPG 预览图
  delivery_link,   // 发货链接（可空）
  status,          // on_sale | off_sale
  created_at,
  updated_at
}
```

### ownerships（素材所有权）

```js
{
  _id,
  user_id,
  item_id,
  acquisition_type, // self | sponsored | transfer_in | transfer_out
  points_delta,     // 此条记录对积分的贡献
  occurred_at,
  delivery_link,    // 可空（转出/赞助无）
  source_user_id,   // 来源用户（被赞助/转入时）
  replaced_by       // 转出时指向替换记录
}
```

### transactions（交易事件）

```js
{
  _id,
  type,             // purchase_self | purchase_sponsor | sponsored | transfer_out | transfer_in
  actor_id,         // 操作方
  target_id,        // 目标方（赞助/转让时）
  item_id,
  price,
  points_change,
  has_delivery_link,
  occurred_at,
  metadata          // 扩展字段
}
```

### vip_levels（VIP 等级配置）

```js
{
  _id,
  level,            // 1~5（可扩展）
  threshold,        // 积分门槛
  perks: {
    buyback_per_year,
    transfer_per_year,
    skip_queue_per_year,
    priority_buy
  },
  active
}
```

### applications（申请记录）

```js
{
  _id,
  type,         // platform_change | print_report
  user_id,
  payload,      // 申请详情（JSON）
  status,       // pending | approved | rejected
  decided_by,
  decided_at,
  remark
}
```

### audit_logs（审计日志）

```js
{
  _id,
  actor_id,
  action,
  entity,
  before,       // 变更前快照
  after,        // 变更后快照
  occurred_at,
  ip,
  ua
}
```

---

## 7. API 规格

### 认证与账号

```
POST /auth/register              {username, password, email?}
POST /auth/login                 {username, password}
POST /auth/email/send-verify     {email}
POST /auth/email/verify          {email, code}
POST /auth/password/forgot       {email}
POST /auth/password/reset        {email, code, new_password}
POST /auth/password/change       {old_password, new_password}
```

> 未绑定或未验证邮箱的账户无法自助找回密码，只能管理员人工重置。

### 用户概览

```
GET  /me/summary
GET  /me/activities?type=&from=&to=&page=&limit=
```

### 我的素材

```
GET  /assets?topic=&artist=&type=&page=&limit=
POST /assets/transfer            {item_id, target_platform, target_id, target_qq}
POST /assets/sponsor             {item_id, target_platform, target_id, target_qq}
```

### 帮助 / 申请

```
POST /applications/platform-change   {new_platform}
POST /applications/print-report      {item_id, derivative_type, creator_id?, creator_qq?, copies, purpose}
GET  /applications                   查看我的申请列表
```

### 管理员接口

```
# 商品管理
POST   /admin/items
PUT    /admin/items/:id
GET    /admin/items

# 交易导入
POST   /admin/transactions/import    (CSV 批量)

# VIP 导入
POST   /admin/vips/import            (CSV：email?, qq?, vip_level, points)

# 查询与修改
GET    /admin/users
PUT    /admin/users/:id
GET    /admin/ownerships?item_id=
GET    /admin/transfers
POST   /admin/transfers/:id/rollback

# VIP 管理
GET    /admin/vips/levels
POST   /admin/vips/levels
PUT    /admin/vips/levels/:id
GET    /admin/vips/customers
POST   /admin/vips/reset-counters    (按等级批量重置转让/回购次数)
POST   /admin/vips/reset-annual-spend

# 审核
GET    /admin/applications?type=&status=
PATCH  /admin/applications/:id       {status, remark}

# 导出
GET    /admin/export/transfers       (CSV/Excel)
GET    /admin/export/vips
```

---

## 8. VIP 等级与权益

| 等级 | 积分门槛 | 回购/年 | 转让/年 | 免抢/年 | VIP 优先购 |
|------|---------|---------|---------|---------|-----------|
| VIP1 | 888 | 1 | — | — | ✅ |
| VIP2 | 2,688 | 1 | 1 | — | ✅ |
| VIP3 | 5,688 | 2 | 2 | — | ✅ |
| VIP4 | 8,888 | 2 | 3 | 3 | ✅ |
| VIP5 | 16,888 | 3 | 6 | 6 | ✅ |

**降级规则**：上一自然年年度消费为 0 → 次年等级降一级（首年统计截至 2026/12/31）。

**系统内转让限制**：仅限 2025 年 4 月后在「我的素材」中购买的授权；2025 年 4 月前的授权须退圈后线下转让。

---

## 9. 核心业务规则

### 积分与年度消费的区别

```
积分（points_total）   = 所有购买/赞助/转入的价格之和（全时段）
年度消费（annual_spend）= 截至 2026/12/31 的「购买类」积分合计（降级判定口径）
```

### 转出业务流程

1. VIP 用户选择「自用」状态的素材 → 发起转让
2. 填写接转方平台 / ID / QQ 并二次确认
3. 原「购买-自用」条目替换为「转出」（无发货链接，积分 = 0）
4. 账户动态首页显示 -积分（累加展示）
5. 接转方生成「转入」条目（有发货链接，+积分 = 价格）
6. 消耗转让次数 1 次

### 赞助业务流程

1. 用户选择商品 → 赞助给某人
2. 填写被赞助人平台 / ID / QQ → 二次确认
3. 赞助人：「购买-赞助」条目，积分 +价格，无发货链接
4. 被赞助人：「被赞助」条目，积分 +0，有发货链接

### 自印报备规则

- 份数上限：30 份
- 需选择我的素材中已持有的素材
- 二创延申类型联动填写：选「无」则不需填二创作者信息
- 提交后进入审核队列，审核通过生成正式报备记录

### 年度清算

- 每年年底运行年度清零：年度消费为 0 的 VIP 用户降级
- 新年度 VIP 转让/回购次数批量重置
- 每日对账校验积分一致性

---

## 10. 技术栈与架构

### 推荐技术栈（目标版本）

| 层次 | 技术 |
|------|------|
| **前端** | Vue 3 + Vite + TypeScript + Pinia + Vue Router + TailwindCSS |
| **后端** | Node.js + NestJS（或 Express）+ TypeScript |
| **数据库** | MongoDB（Mongoose） |
| **缓存** | Redis（会话、验证码、队列） |
| **文件存储** | S3 / 阿里云 OSS / MinIO（商品预览图） |
| **鉴权** | JWT（Access Token 7d + Refresh Token 30d）；邮箱验证码（10min 有效期） |
| **运维** | Nginx 反向代理 + Docker / PM2；日志 ELK/EFK |
| **安全** | RBAC；密码 bcrypt 加盐；验证码限流；CSRF/XSS 防护；PII 加密；审计日志 |

### 系统架构图

```
                         ┌─────────────┐
                         │  用户浏览器  │
                         └──────┬──────┘
                                │ HTTPS
                         ┌──────▼──────┐
                         │    Nginx    │  反向代理 + 静态托管
                         └──────┬──────┘
               ┌────────────────┼────────────────┐
               │                │                │
        ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
        │  前端 SPA   │  │  后端 API   │  │  管理后台   │
        │  Vue 3+TS  │  │  NestJS+TS │  │  Vue 3+TS  │
        └─────────────┘  └──────┬──────┘  └─────────────┘
                                │
               ┌────────────────┼────────────────┐
               │                │                │
        ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
        │   MongoDB   │  │    Redis    │  │  OSS/MinIO  │
        │（主数据库） │  │（缓存/队列）│  │（图片存储） │
        └─────────────┘  └─────────────┘  └─────────────┘
```

---

## 11. 目录结构

```
shiyuan-website/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── auth/               # 认证模块（注册/登录/邮箱验证/找回密码）
│   │   ├── users/              # 用户管理
│   │   ├── items/              # 商品管理
│   │   ├── ownerships/         # 素材所有权（我的素材）
│   │   ├── transactions/       # 交易事件
│   │   ├── vip/                # VIP 等级与权益
│   │   ├── applications/       # 平台更换 / 自印报备申请
│   │   ├── admin/              # 管理员后台接口
│   │   ├── audit/              # 审计日志
│   │   ├── common/             # 通用中间件/过滤器/装饰器
│   │   └── config/             # 配置与环境变量
│   ├── test/
│   ├── package.json
│   └── .env.example
│
├── frontend/                   # 用户端前端（Vue 3）
│   ├── src/
│   │   ├── views/
│   │   │   ├── auth/           # 登录 / 注册 / 找回密码
│   │   │   ├── assets/         # 我的素材
│   │   │   ├── activities/     # 账户动态
│   │   │   ├── help/           # 我的帮助（平台更换 / 自印报备）
│   │   │   ├── vip/            # VIP 权益
│   │   │   └── shop/           # 店铺授权
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── api/                # API 请求封装
│   │   ├── components/         # 公共组件
│   │   └── router/
│   └── package.json
│
├── admin/                      # 管理员后台（Vue 3）
│   ├── src/
│   │   ├── views/
│   │   │   ├── items/          # 商品管理
│   │   │   ├── transactions/   # 交易导入与查询
│   │   │   ├── vips/           # VIP 导入与管理
│   │   │   ├── users/          # 用户查询与修改
│   │   │   ├── applications/   # 审核中心
│   │   │   └── transfers/      # 转让记录查询
│   │   └── ...
│   └── package.json
│
├── preview/                    # 静态设计预览（美工参考）
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── upload.html
│   └── styles.css
│
├── deploy/                     # 部署配置
│   ├── nginx.conf
│   ├── docker-compose.yml
│   └── ecosystem.config.js     # PM2 配置
│
├── docs/                       # 项目文档
│   ├── 素材管理系统_PRD_V2.docx
│   └── 素材管理系统综述.docx
│
├── DEPLOY.md                   # 部署操作手册
└── README.md                   # 本文件
```

---

## 12. 本地开发

### 环境要求

- Node.js >= 18.x
- MongoDB >= 6.x
- Redis >= 7.x

### 后端

```bash
cd backend
cp .env.example .env
# 编辑 .env 填写 MONGODB_URI、JWT_SECRET、REDIS_URL、MAIL_* 等
npm install
npm run dev
# 服务运行在 http://localhost:3000
```

### 前端（用户端）

```bash
cd frontend
npm install
npm run dev
# 运行在 http://localhost:5173
```

### 管理后台

```bash
cd admin
npm install
npm run dev
# 运行在 http://localhost:5174
```

### 环境变量说明（后端 .env）

| 变量 | 必填 | 说明 |
|------|------|------|
| `NODE_ENV` | ✅ | `development` / `production` |
| `PORT` | — | 后端端口，默认 3000 |
| `MONGODB_URI` | ✅ | MongoDB 连接字符串 |
| `REDIS_URL` | ✅ | Redis 连接地址 |
| `JWT_SECRET` | ✅ | JWT 签名密钥（64 位以上随机字符串） |
| `JWT_REFRESH_SECRET` | ✅ | Refresh Token 签名密钥 |
| `MAIL_HOST` | — | SMTP 服务器（邮箱验证功能需要） |
| `MAIL_USER` | — | SMTP 用户名 |
| `MAIL_PASS` | — | SMTP 密码 |
| `OSS_ENDPOINT` | — | 对象存储地址 |
| `OSS_BUCKET` | — | Bucket 名称 |
| `OSS_ACCESS_KEY` | — | Access Key |
| `OSS_SECRET_KEY` | — | Secret Key |
| `CORS_ORIGIN` | — | 允许跨域的前端地址 |
| `LOG_LEVEL` | — | 日志级别（默认 `info`） |

---

## 13. 部署指南

详见 [DEPLOY.md](./DEPLOY.md)，包含以下内容：

- 服务器环境要求与端口规划
- Node.js / MongoDB / Redis / Nginx 完整安装步骤
- 后端环境变量配置与安全建议
- 前端构建与 Nginx 反向代理配置
- PM2 集群模式与开机自启
- Let's Encrypt HTTPS 证书
- MongoDB 安全加固与定时备份
- 更新部署流程
- 故障排查指南

---

## 14. 当前版本（V0）说明

> **重要**：当前 `material-management-system/` 目录下的代码是**早期原型（V0）**，实现的是一套通用文件上传/管理功能，与本 PRD 描述的完整业务系统存在较大差距。

### V0 已实现

- ✅ 用户注册 / 登录（JWT）
- ✅ 文件上传（multer）、下载、删除
- ✅ 文件列表搜索与分页
- ✅ 基础安全加固（helmet / rate-limit / express-validator）
- ✅ 结构化日志（winston + morgan）
- ✅ 静态设计预览页（`preview/`）

### V0 与 PRD 的主要差距

| 功能 | V0 状态 | 目标状态 |
|------|---------|---------|
| 素材所有权模型 | ❌ | 需要 ownership / transaction 双表 |
| VIP 等级系统 | ❌ | VIP1~VIP5，积分自动判定 |
| 积分 / 年度消费 | ❌ | 完整积分引擎与口径区分 |
| 赞助 / 转让流程 | ❌ | 完整状态机与权限校验 |
| 管理员批量导入 | ❌ | CSV 导入商品 / 交易 / VIP |
| 邮箱验证 / 找回密码 | ❌ | SMTP 验证码流程 |
| 平台更换 / 自印报备 | ❌ | 申请 → 审核 完整流程 |
| 审计日志 | ❌ | 管理员操作全量镜像 |
| Refresh Token | ❌ | 双 Token 机制 |
| 对象存储（OSS） | ❌ | 替换本地 uploads 目录 |
| 管理员后台 | ❌ | 独立 admin 前端应用 |

V0 可作为技术验证原型参考，正式系统需按本 README 重新规划开发。

---

*文档整合自《素材管理系统_PRD_V2.docx》与《素材管理系统综述.docx》*
*整合日期：2026-03-16*
