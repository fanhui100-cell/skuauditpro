# SKUProfit 全栈项目

SKUProfit 是一个面向跨境电商卖家的 SKU 利润体检工具。当前版本是可本地完整运行的前后端项目，包含免费页面、邮箱登录、用户后台、套餐下单、人工付款审核、管理后台和批量 SKU 利润报告。

## 运行

```powershell
node server.mjs
```

浏览器打开：

```text
http://127.0.0.1:4173/
```

## 页面

- 免费落地页：`/`
- 登录/注册：`/login.html`
- 用户后台：`/dashboard.html`
- 管理后台：`/admin.html`

管理后台默认管理码：

```text
skuprofit-admin
```

上线时建议用环境变量修改：

```powershell
$env:ADMIN_CODE="your-strong-admin-code"
node server.mjs
```

## 已完成能力

- 单 SKU 利润计算
- 批量 SKU CSV 体检
- 风险排序
- 体检 CSV 导出
- 免费线索表单
- 线索后端保存
- 邮箱注册/登录
- 微信/Google 演示登录入口
- 套餐配置
- 订单创建
- 人工付款备注提交
- 管理员审核订单并开通套餐
- 文件型 JSON 数据库：`data/db.json`

## 真实上线前要补

- HTTPS 域名
- 数据库替换为 PostgreSQL / MySQL / Supabase
- 邮箱验证码或邮件登录
- 正式微信开放平台登录
- 正式 Google OAuth
- Stripe HK / Paddle / Lemon Squeezy 等真实支付
- 支付 Webhook 自动开通套餐
- 管理后台权限隔离
- 隐私政策、服务条款、退款规则

