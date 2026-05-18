# SKUAuditPro Aliyun Deployment

Target domain: `skuauditpro.com`

Target app port: `4173`

## DNS

Create these records at the domain registrar:

```text
A     @     8.218.40.11
A     www   8.218.40.11
```

## Server Setup

On the Ubuntu server:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx rsync
sudo npm install -g pm2
```

Open ports `80` and `443` in the Aliyun firewall/security group.

## Environment

Create `/var/www/skuauditpro/current/.env` after upload:

```bash
PORT=4173
NODE_ENV=production
APP_BASE_URL=https://skuauditpro.com
FORCE_HTTPS=true
ADMIN_USERS=[{"id":"owner","name":"Owner","code":"replace-with-a-long-random-code"}]
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EMAIL_WEBHOOK_URL=
EMAIL_WEBHOOK_TOKEN=
```

## TLS

After DNS points to the server:

```bash
sudo certbot --nginx -d skuauditpro.com -d www.skuauditpro.com
```

## Deploy

From this `sku` directory on the server:

```bash
bash deploy/scripts/deploy-aliyun.sh
```

Health checks:

```bash
curl -I https://skuauditpro.com/
curl https://skuauditpro.com/api/health
curl https://skuauditpro.com/api/ready
```
