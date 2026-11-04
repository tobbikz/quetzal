#!/bin/sh
# Smoke Quetzal Compose stack (health + public portal + cron auth + mailpit).
set -eu
BASE="${QUETZAL_BASE_URL:-http://127.0.0.1:3210}"
SECRET="${QUETZAL_AUTOMATION_CRON_SECRET:-}"
MAILUI="${QUETZAL_MAILPIT_UI:-http://127.0.0.1:8025}"

echo "[smoke] health"
code=$(curl -fsS -o /tmp/qz-health.json -w "%{http_code}" "$BASE/api/health")
test "$code" = "200"
grep -q '"ok":true' /tmp/qz-health.json || grep -q '"ok": true' /tmp/qz-health.json
cat /tmp/qz-health.json
echo

echo "[smoke] login page"
curl -fsS -o /dev/null -w "login:%{http_code}\n" "$BASE/login" | grep 200

echo "[smoke] portal (public)"
curl -fsS -o /dev/null -w "portal:%{http_code}\n" "$BASE/portal" | grep 200

if [ -n "$SECRET" ]; then
  echo "[smoke] automation tick"
  curl -fsS -X POST \
    -H "Authorization: Bearer $SECRET" \
    "$BASE/api/automation/tick" | tee /tmp/qz-tick.json
  echo
  grep -q '"ok":true' /tmp/qz-tick.json || grep -q '"ok": true' /tmp/qz-tick.json
else
  echo "[smoke] skip tick (no QUETZAL_AUTOMATION_CRON_SECRET)"
fi

echo "[smoke] mailpit UI"
curl -fsS -o /dev/null -w "mailpit:%{http_code}\n" "$MAILUI/" | grep -E '200|302' || true

echo "[smoke] OK"
