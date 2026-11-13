#!/bin/bash
# Starts the whole app on the stage server. It runs on every start of the server
# (systemd unit "namma-stage"), so "start the server" is all it takes to bring the
# site up, and a restart after `cdk deploy` picks up the new version.
#
# What runs here, each in its own Docker container:
#   db   PostgreSQL + PostGIS. Its data is on the server's disk, so it survives a stop.
#   api  the API image, on port 4000
#   web  the website image, on port 3000
# CloudFront is the only thing allowed to reach ports 3000 and 4000.
#
# It is safe to run again at any time: it only creates what is missing.
set -euo pipefail

HOME_DIR="${NAMMA_HOME:-/opt/namma}"
PARAMS="${NAMMA_PARAMS:-/namma-trails/stage}"
DB_IMAGE="${DB_IMAGE:-postgis/postgis:17-3.5}"
WEB_PUBLISH="${WEB_PUBLISH:-3000}"
API_PUBLISH="${API_PUBLISH:-4000}"
NAMES="${NAMMA_PREFIX:-}" # only set in a local trial, to keep its containers apart

mkdir -p "$HOME_DIR"
cd "$HOME_DIR"
log() { echo "[namma-stage] $*"; }

# ── 1. Which version to run ──────────────────────────────────────────────────
# On AWS the image names and the site address are read from Parameter Store, where
# `cdk deploy` puts them. (For a trial on a laptop they can be given as variables.)
if [ -z "${API_IMAGE:-}" ]; then
  TOKEN=$(curl -sf -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
  REGION=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)
  param() { aws ssm get-parameter --region "$REGION" --name "$PARAMS/$1" --query Parameter.Value --output text; }
  API_IMAGE=$(param api-image)
  WEB_IMAGE=$(param web-image)
  SITE_URL=$(param site-url)
  DEMO_DATA=$(param demo-data)
  log "signing in to the image store and downloading the images"
  aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${API_IMAGE%%/*}" >/dev/null
  docker pull -q "$API_IMAGE"
  docker pull -q "$WEB_IMAGE"
fi
DEMO_DATA="${DEMO_DATA:-true}"

# ── 2. Secrets: made once on this server, never leave it ─────────────────────
if [ ! -f secrets.env ]; then
  log "creating the secrets (first start)"
  (
    umask 077
    {
      echo "DB_PASSWORD=$(openssl rand -hex 24)"
      echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
      echo "OTP_PEPPER=$(openssl rand -hex 24)"
    } >secrets.env
  )
fi
# shellcheck disable=SC1091
. ./secrets.env

# The API's settings. Development mode: demo data, test payments, messages go to the log.
(
  umask 077
  cat >api.env <<EOF
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://kt:${DB_PASSWORD}@${NAMES}db:5432/namma_trails?schema=public
CORS_ORIGINS=${SITE_URL}
PUBLIC_WEB_URL=${SITE_URL}
TRUST_PROXY_HOPS=1
MESSAGING_PROVIDER=console
PAYMENT_PROVIDER=mock
DEMO_DATA_ENABLED=${DEMO_DATA}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
OTP_PEPPER=${OTP_PEPPER}
EOF
)

# ── 3. Database ──────────────────────────────────────────────────────────────
docker network inspect "${NAMES}namma" >/dev/null 2>&1 || docker network create "${NAMES}namma" >/dev/null
if docker inspect "${NAMES}db" >/dev/null 2>&1; then
  docker start "${NAMES}db" >/dev/null
else
  log "creating the database"
  docker run -d --name "${NAMES}db" --network "${NAMES}namma" --restart unless-stopped \
    -e POSTGRES_USER=kt -e POSTGRES_PASSWORD="$DB_PASSWORD" -e POSTGRES_DB=namma_trails \
    -v "${NAMES}namma-pgdata:/var/lib/postgresql/data" "$DB_IMAGE" >/dev/null
fi
log "waiting for the database"
ready=0
for _ in $(seq 1 90); do
  if docker exec "${NAMES}db" pg_isready -q -U kt -d namma_trails >/dev/null 2>&1; then
    ready=$((ready + 1))
    # Twice in a row: the first "ready" can be the short start-up phase of a new database.
    [ "$ready" -ge 2 ] && break
  else
    ready=0
  fi
  sleep 2
done
[ "$ready" -ge 2 ] || { log "the database did not start"; exit 1; }

# ── 4. Bring the database up to date, load the starting data once ────────────
api_job() { docker run --rm --network "${NAMES}namma" --env-file api.env "$API_IMAGE" "$@"; }
log "applying database changes"
api_job node_modules/.bin/prisma migrate deploy
if [ ! -f seeded ]; then
  log "loading the starting data (first start)"
  api_job node dist/prisma/seed.js
  # The demo script prints the demo password; it is in docs/15-demo-data.md, so keep it out of the log.
  if [ "$DEMO_DATA" = "true" ]; then api_job node dist/prisma/seed-demo.js | grep -vi "password" || true; fi
  touch seeded
fi

# ── 5. The API and the website ───────────────────────────────────────────────
log "starting the API and the website"
docker rm -f "${NAMES}api" "${NAMES}web" >/dev/null 2>&1 || true
docker run -d --name "${NAMES}api" --network "${NAMES}namma" --restart unless-stopped -p "${API_PUBLISH}:4000" --env-file api.env "$API_IMAGE" >/dev/null
docker run -d --name "${NAMES}web" --network "${NAMES}namma" --restart unless-stopped -p "${WEB_PUBLISH}:3000" -e PORT=3000 -e HOSTNAME=0.0.0.0 "$WEB_IMAGE" >/dev/null

# Old image versions are no longer needed; free the disk.
docker image prune -af >/dev/null 2>&1 || true
log "done: ${SITE_URL}"
