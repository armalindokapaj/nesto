#!/usr/bin/env bash
#
# The local development database.
#
# Why this exists: the Neon compute this project deploys against lives in
# us-east-1. From a developer machine in Europe a single round trip to it
# measured ~230ms, with regular multi-second spikes, and Prisma spends two to
# three round trips per query (a pool health-check "SELECT 1", then
# prepare/execute). A page issuing ~14 queries paid 1.5-10s of pure network
# wait before rendering anything. The same queries against a local Postgres
# are sub-millisecond, which is the difference between a 1.5s page and a 60ms
# one. Nothing in the application changed to get that.
#
# Neon stays the source of truth. This script only ever reads from it.
#
#   ./scripts/db-local.sh up        start the container (idempotent)
#   ./scripts/db-local.sh refresh   re-copy Neon's data into it, replacing all
#                                   local data
#   ./scripts/db-local.sh status    where is DATABASE_URL pointing, is it up
#
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER=nestoweb-postgres
VOLUME=nestoweb-pgdata
PORT=5434
PGUSER=nesto
PGPASS=nesto_dev
PGDB=nestoweb
# Pinned to Neon's own server version: pg_dump refuses to dump from a server
# newer than itself, and the restore side must understand what it produced.
IMAGE=postgres:17-alpine

env_value() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"'; }

up() {
  if [ -n "$(docker ps -q -f "name=^${CONTAINER}$")" ]; then
    echo "already running on port ${PORT}"
  else
    if [ -n "$(docker ps -aq -f "name=^${CONTAINER}$")" ]; then
      docker start "$CONTAINER" >/dev/null
    else
      docker run -d --name "$CONTAINER" --restart unless-stopped \
        -e POSTGRES_USER="$PGUSER" -e POSTGRES_PASSWORD="$PGPASS" -e POSTGRES_DB="$PGDB" \
        -p "${PORT}:5432" -v "${VOLUME}:/var/lib/postgresql/data" "$IMAGE" >/dev/null
    fi
    printf "starting"
    for _ in $(seq 1 60); do
      if docker exec "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" -tAc "select 1" >/dev/null 2>&1; then
        echo " ready on port ${PORT}"; return
      fi
      printf "."; sleep 1
    done
    echo; echo "container did not become ready" >&2; exit 1
  fi
}

refresh() {
  local source
  source="$(env_value NEON_SOURCE_URL)"
  [ -n "$source" ] || { echo "NEON_SOURCE_URL is not set in .env" >&2; exit 1; }

  # The restore drops every table it recreates, so make certain the target is
  # the local container and not whatever DATABASE_URL happens to say.
  case "$(env_value DATABASE_URL)" in
    *localhost:${PORT}*|*127.0.0.1:${PORT}*) ;;
    *) echo "refusing: DATABASE_URL does not point at localhost:${PORT}" >&2; exit 1 ;;
  esac

  up
  # Password out of the URL and into the environment, so it is not visible in
  # the container's process list.
  local pw url
  pw="$(printf '%s' "$source" | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#')"
  url="$(printf '%s' "$source" | sed -E 's#(://[^:]+):[^@]+@#\1@#')"

  echo "dumping from Neon (crosses the slow link once)..."
  docker exec -e PGPASSWORD="$pw" "$CONTAINER" \
    pg_dump --no-owner --no-acl --no-comments -Fc -d "$url" -f /tmp/neon.dump

  echo "restoring into ${PGDB}..."
  docker exec "$CONTAINER" pg_restore --clean --if-exists --no-owner --no-acl \
    -U "$PGUSER" -d "$PGDB" /tmp/neon.dump
  docker exec "$CONTAINER" rm -f /tmp/neon.dump

  docker exec "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" -c \
    'select (select count(*) from "UserIdentity") as users,
            (select count(*) from "Project") as projects,
            (select count(*) from "Task") as tasks;'
}

status() {
  echo "DATABASE_URL -> $(env_value DATABASE_URL | sed -E 's#(://[^:]+:)[^@]+@#\1***@#')"
  if [ -n "$(docker ps -q -f "name=^${CONTAINER}$")" ]; then
    echo "container     -> running on port ${PORT}"
  else
    echo "container     -> NOT running (./scripts/db-local.sh up)"
  fi
}

case "${1:-status}" in
  up) up ;;
  refresh) refresh ;;
  status) status ;;
  *) echo "usage: $0 {up|refresh|status}" >&2; exit 1 ;;
esac
