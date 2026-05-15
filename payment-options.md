# SKUProfit 支付接入方案

你现在有国内银行卡和香港储蓄卡/信用卡，建议按阶段处理支付。

## 第一阶段：人工收款，最快能开始

适合刚推广、客户不多时使用。

可用方式：

- 国内银行卡转账
- 香港银行卡 / FPS 转账
- 微信或支付宝人工收款码
- 服务商代收后返佣

当前项目已经支持：

- 用户选择套餐
- 创建订单
- 用户提交付款备注
- 管理员在后台标记已付款
- 标记后自动开通套餐

优点：

- 不需要支付牌照或平台审核
- 今天就能开始收首批测试客户
- 适合 ¥299 / ¥999 这类咨询诊断服务

缺点：

- 不能自动确认付款
- 不适合大规模订阅
- 个人收款长期商业化有合规风险

## 第二阶段：Stripe HK

如果你能注册 Stripe 香港账户，香港银行卡更适合接入 Stripe。

适合：

- 海外信用卡
- Google Pay / Apple Pay
- Alipay
- WeChat Pay
- 订阅收费

当前代码已预留 `stripe-hk` 付款方式。需要配置：

```powershell
$env:STRIPE_SECRET_KEY="sk_live_xxx"
$env:STRIPE_PRICE_AUDIT_20_SKU="price_xxx"
$env:STRIPE_PRICE_STORE_AUDIT="price_xxx"
$env:STRIPE_PRICE_PRO_MONTHLY="price_xxx"
node server.mjs
```

还需要补：

- Stripe webhook
- 付款成功后自动把订单标记为 paid
- 退款和发票处理

## 第三阶段：Merchant of Record

如果你暂时不想处理税务、发票、跨境收单，可以考虑 Paddle 或 Lemon Squeezy 这类 Merchant of Record。

适合：

- SaaS 订阅
- 海外客户
- 不想自己处理部分税务和付款合规

缺点：

- 平台审核可能更严格
- 费率通常更高
- 有些平台对中国大陆主体支持有限，需要确认你的主体、银行账户和业务类型是否通过审核

## 微信 / Google 登录

当前项目里的微信和 Google 是演示登录，用于跑通产品流程。

正式上线需要：

- 微信开放平台网站应用
- Google Cloud OAuth Client
- 真实域名和回调 URL
- 后端验证 OAuth code
- 绑定或创建本地用户

本地开发阶段先保留邮箱登录即可。

