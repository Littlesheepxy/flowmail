#!/bin/bash
# Flowmail 502 诊断脚本
# 在腾讯云服务器上运行：bash /opt/flowmail/scripts/diagnose.sh

set -euo pipefail
COMPOSE="docker compose -f /opt/flowmail/docker-compose.prod.yml"
ENV_FILE="/opt/flowmail/.env"
CERT_DIR="/etc/ssl/cloudflare"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }
section() { echo -e "\n══════════════════════════════════════"; echo "  $*"; echo "══════════════════════════════════════"; }

section "1. Docker Compose 容器状态"
$COMPOSE ps 2>/dev/null || fail "docker compose ps 失败，请检查是否在 /opt/flowmail 目录"

section "2. 关键 env 变量检查（值已脱敏）"
for var in DATABASE_URL BETTER_AUTH_SECRET NEXT_PUBLIC_SITE_URL POSTGRES_PASSWORD RESEND_API_KEY; do
  if grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
    val=$(grep "^${var}=" "$ENV_FILE" | cut -d= -f2- | head -c 50)
    if [ -z "$val" ] || [ "$val" = '""' ] || [ "$val" = "''" ]; then
      fail "${var} 已配置但值为空"
    else
      ok "${var} 已配置"
    fi
  else
    fail "${var} 未在 .env 中找到"
  fi
done

section "3. SSL 证书文件"
if [ -f "${CERT_DIR}/origin.pem" ] && [ -f "${CERT_DIR}/origin.key" ]; then
  ok "SSL 证书存在"
  openssl x509 -noout -enddate -in "${CERT_DIR}/origin.pem" 2>/dev/null | sed 's/^/    /'
else
  fail "SSL 证书不存在: ${CERT_DIR}/origin.pem 或 origin.key"
  warn "需要放置 Cloudflare Origin 证书（控制台 → SSL/TLS → Origin Server → Create Certificate）"
fi

section "4. web 容器日志（最近 50 行）"
$COMPOSE logs --tail=50 web 2>&1 | grep -E --color=never "error|Error|FATAL|WARN|ready|listen|started|failed|Cannot|prisma|database|connect" | head -40 || $COMPOSE logs --tail=30 web

section "5. Nginx 状态与日志"
nginx_status=$($COMPOSE ps nginx --format json 2>/dev/null | grep -o '"Status":"[^"]*"' | head -1 || echo "unknown")
echo "Nginx 状态: $nginx_status"
$COMPOSE logs --tail=20 nginx 2>&1 | tail -20

section "6. 网络连通性测试"
# 测试 nginx → web
echo -n "  Nginx → web:3000  : "
$COMPOSE exec -T nginx wget -qO- --timeout=3 http://web:3000/api/health 2>/dev/null \
  && ok "连通" || fail "无法连接 web:3000（web 容器可能未启动或端口错误）"

# 测试宿主机 → web（绕过 nginx）
echo -n "  宿主机 → localhost:3000 : "
curl -sf --max-time 3 http://localhost:3000/api/health 2>/dev/null \
  && ok "连通" || warn "宿主机直连失败（web 容器可能未暴露端口，这是正常的——web 只在 internal 网络）"

# 测试 nginx 本地
echo -n "  宿主机 → localhost:443 : "
curl -skf --max-time 3 https://localhost/api/health 2>/dev/null \
  && ok "Nginx 返回 200" || warn "Nginx 443 无响应"

section "7. 端口监听"
ss -tlnp 2>/dev/null | grep -E ":80|:443" || netstat -tlnp 2>/dev/null | grep -E ":80|:443" || warn "无法检测端口（ss/netstat 不可用）"

section "8. 快速建议"
echo ""
echo "  如果 web 容器是 Exited / Restarting："
echo "    → 运行: $COMPOSE logs --tail=100 web"
echo "    → 最常见原因: DATABASE_URL 错误 或 BETTER_AUTH_SECRET 未设置"
echo ""
echo "  如果 SSL 证书缺失："
echo "    → 在 Cloudflare 控制台生成 Origin Certificate，保存到 ${CERT_DIR}/"
echo ""
echo "  如果一切看起来正常但还是 502："
echo "    → 检查 Cloudflare SSL 模式: 控制台 → SSL/TLS → 改为 Full (非 Flexible)"
echo ""
