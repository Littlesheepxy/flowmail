#!/bin/bash
# Setup cron job for automatic email sync on the server
# Usage: CRON_SECRET=your_secret ./scripts/setup-cron.sh

CRON_SECRET="${CRON_SECRET:-$(grep CRON_SECRET .env 2>/dev/null | cut -d= -f2)}"
APP_URL="${APP_URL:-http://localhost:3000}"

if [ -z "$CRON_SECRET" ]; then
  CRON_SECRET=$(openssl rand -hex 16)
  echo "Generated CRON_SECRET: $CRON_SECRET"
  echo ""
  echo "Add to your .env file:"
  echo "  CRON_SECRET=$CRON_SECRET"
  echo ""
fi

CRON_CMD="*/3 * * * * curl -s -H 'Authorization: Bearer $CRON_SECRET' '$APP_URL/api/cron/sync-emails' >> /var/log/flowmail-sync.log 2>&1"

echo "Cron job to add (runs every 3 minutes):"
echo ""
echo "$CRON_CMD"
echo ""
echo "To install, run:"
echo "  (crontab -l 2>/dev/null; echo \"$CRON_CMD\") | crontab -"
