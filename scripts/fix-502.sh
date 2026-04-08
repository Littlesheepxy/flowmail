#!/bin/bash
# Flowmail 502 一键修复脚本（在诊断确认问题后运行对应模块）
# 用法: bash /opt/flowmail/scripts/fix-502.sh [restart|gen-secret|check-env]

set -euo pipefail
COMPOSE="docker compose -f /opt/flowmail/docker-compose.prod.yml"
ENV_FILE="/opt/flowmail/.env"

cmd="${1:-help}"

case "$cmd" in
  restart)
    echo "=== 重启所有服务 ==="
    cd /opt/flowmail
    $COMPOSE down --remove-orphans
    $COMPOSE up -d
    sleep 8
    $COMPOSE ps
    echo ""
    echo "=== 检查 web 日志 ==="
    $COMPOSE logs --tail=30 web
    ;;

  gen-secret)
    echo "=== 生成 BETTER_AUTH_SECRET ==="
    secret=$(openssl rand -hex 32)
    echo "生成的密钥（复制到 .env）:"
    echo "BETTER_AUTH_SECRET=\"${secret}\""
    ;;

  check-env)
    echo "=== 校验 .env 文件完整性 ==="
    required=(
      DATABASE_URL
      BETTER_AUTH_SECRET
      NEXT_PUBLIC_SITE_URL
      POSTGRES_PASSWORD
    )
    missing=()
    for var in "${required[@]}"; do
      val=$(grep "^${var}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | xargs)
      if [ -z "$val" ]; then
        echo "  [缺失] $var"
        missing+=("$var")
      else
        echo "  [OK]   $var"
      fi
    done
    if [ ${#missing[@]} -gt 0 ]; then
      echo ""
      echo "请在 $ENV_FILE 中补全以上变量，然后运行:"
      echo "  bash /opt/flowmail/scripts/fix-502.sh restart"
    fi
    ;;

  fix-db-url)
    echo "=== 修正 DATABASE_URL（如果你填的是 localhost）==="
    echo "docker-compose 内部网络中，postgres 服务名就是主机名"
    echo "正确格式: DATABASE_URL=\"postgresql://flowmail:PASSWORD@postgres:5432/flowmail\""
    echo ""
    echo "当前 DATABASE_URL:"
    grep "^DATABASE_URL=" "$ENV_FILE" | head -1
    ;;

  help|*)
    echo "用法: bash fix-502.sh <命令>"
    echo ""
    echo "  restart    重启所有 Docker 容器"
    echo "  gen-secret 生成随机 BETTER_AUTH_SECRET"
    echo "  check-env  校验 .env 必填变量"
    echo "  fix-db-url 显示正确的 DATABASE_URL 格式"
    ;;
esac
