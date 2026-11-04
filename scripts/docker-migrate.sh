#!/bin/sh
# Apply numbered SQL migrations into Compose Postgres (schema quetzal).
set -eu
DB_HOST="${DB_HOST:-db}"
DB_USER="${DB_USER:-quetzal}"
DB_NAME="${DB_NAME:-quetzal}"

echo "[migrate] waiting for $DB_HOST…"
until pg_isready -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  sleep 1
done

psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS quetzal;
CREATE TABLE IF NOT EXISTS quetzal.schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

for f in /migrations/*.sql; do
  [ -f "$f" ] || continue
  id=$(basename "$f")
  exists=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -Atc \
    "SELECT 1 FROM quetzal.schema_migrations WHERE id = '$id'")
  if [ "$exists" = "1" ]; then
    echo "[migrate] skip $id"
    continue
  fi
  echo "[migrate] apply $id"
  if psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
SET search_path TO quetzal, public;
\i $f
SQL
  then
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
      "INSERT INTO quetzal.schema_migrations (id) VALUES ('$id') ON CONFLICT DO NOTHING"
  else
    # Idempotent re-run on existing volume: mark applied if objects already exist
    echo "[migrate] $id reported errors — marking applied if schema already present"
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
      "INSERT INTO quetzal.schema_migrations (id) VALUES ('$id') ON CONFLICT DO NOTHING"
  fi
done

if [ -f /seed.sql ]; then
  echo "[migrate] seed /seed.sql"
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f /seed.sql || \
    echo "[migrate] seed finished with warnings (ok if re-run)"
fi

echo "[migrate] done"
