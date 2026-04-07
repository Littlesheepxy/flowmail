#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Flowmail Server Initialization Script
# Target: Tencent Cloud Lighthouse (Ubuntu 22.04+)
# Usage:  curl -sSL <raw-url> | bash
#   or:   chmod +x server-init.sh && ./server-init.sh
# ============================================================

echo "🚀 Flowmail Server Init — Starting..."

# ── 1. System Update ──
echo "📦 Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ── 2. Install Docker ──
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    sudo systemctl enable docker
    sudo systemctl start docker
    echo "✅ Docker installed"
else
    echo "✅ Docker already installed: $(docker --version)"
fi

# ── 3. Install Docker Compose Plugin ──
if ! docker compose version &> /dev/null; then
    echo "🐳 Installing Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose installed"
else
    echo "✅ Docker Compose already installed: $(docker compose version)"
fi

# ── 4. Create project directory ──
echo "📁 Setting up project directory..."
sudo mkdir -p /opt/flowmail/nginx
sudo chown -R "$USER:$USER" /opt/flowmail

# ── 5. Setup Cloudflare Origin Certificate ──
echo "🔒 Setting up SSL directory..."
sudo mkdir -p /etc/ssl/cloudflare

if [ ! -f /etc/ssl/cloudflare/origin.pem ]; then
    echo ""
    echo "⚠️  Cloudflare Origin Certificate not found!"
    echo ""
    echo "Please complete these steps manually:"
    echo "  1. Go to Cloudflare Dashboard → SSL/TLS → Origin Server"
    echo "  2. Click 'Create Certificate'"
    echo "  3. Select RSA (2048), hostnames: *.flowmail.work, flowmail.work"
    echo "  4. Set validity to 15 years"
    echo "  5. Copy the certificate to: /etc/ssl/cloudflare/origin.pem"
    echo "  6. Copy the private key to:  /etc/ssl/cloudflare/origin.key"
    echo ""
    echo "Then run:"
    echo "  sudo chmod 600 /etc/ssl/cloudflare/origin.key"
    echo "  sudo chmod 644 /etc/ssl/cloudflare/origin.pem"
    echo ""
else
    echo "✅ Cloudflare Origin Certificate found"
    sudo chmod 600 /etc/ssl/cloudflare/origin.key
    sudo chmod 644 /etc/ssl/cloudflare/origin.pem
fi

# ── 6. Setup Firewall (ufw) ──
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirect to HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable
echo "✅ Firewall configured"

# ── 7. Setup .env file template ──
if [ ! -f /opt/flowmail/.env ]; then
    cat > /opt/flowmail/.env << 'ENVEOF'
# ── Database ──
POSTGRES_USER=flowmail
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD
POSTGRES_DB=flowmail
DATABASE_URL=postgresql://flowmail:CHANGE_ME_STRONG_PASSWORD@postgres:5432/flowmail

# ── MinIO (S3-compatible storage) ──
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=CHANGE_ME_MINIO_PASSWORD

# ── Application ──
NEXT_PUBLIC_APP_URL=https://flowmail.work
BETTER_AUTH_URL=https://flowmail.work
BETTER_AUTH_SECRET=CHANGE_ME_RANDOM_SECRET

# ── Email (Resend) ──
RESEND_API_KEY=
EMAIL_FROM=noreply@flowmail.work

# ── AI ──
OPENAI_API_KEY=

# ── Storage ──
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=CHANGE_ME_MINIO_PASSWORD
S3_BUCKET=avatars
S3_REGION=us-east-1

# ── Docker Image ──
GITHUB_REPOSITORY=
IMAGE_TAG=latest
ENVEOF
    echo "✅ .env template created at /opt/flowmail/.env"
    echo "⚠️  Please edit /opt/flowmail/.env with real values!"
else
    echo "✅ .env file already exists"
fi

# ── 8. Setup log rotation for Docker ──
echo "📋 Configuring Docker log rotation..."
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
sudo systemctl restart docker
echo "✅ Docker log rotation configured"

# ── 9. Setup automatic security updates ──
echo "🔄 Enabling automatic security updates..."
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
echo "✅ Automatic security updates enabled"

echo ""
echo "============================================"
echo "🎉 Flowmail Server Init Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/flowmail/.env with real credentials"
echo "  2. Setup Cloudflare Origin Certificate (if not done)"
echo "  3. Configure Cloudflare DNS:"
echo "     - A record: flowmail.work → $(curl -s ifconfig.me) (Proxied)"
echo "     - A record: docs.flowmail.work → $(curl -s ifconfig.me) (Proxied)"
echo "     - SSL mode: Full (Strict)"
echo "  4. Add GitHub Secrets to the repository:"
echo "     - SERVER_HOST, SERVER_USER, SERVER_SSH_KEY"
echo "     - PROD_SERVER_HOST, PROD_SERVER_USER, PROD_SERVER_SSH_KEY"
echo "  5. Push to main branch to trigger first deployment"
echo ""
echo "Manual first deploy:"
echo "  cd /opt/flowmail"
echo "  docker compose -f docker-compose.prod.yml pull"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
