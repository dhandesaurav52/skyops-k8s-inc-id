#!/usr/bin/env bash
# ==============================================================================
# SkyOps Self-Hosted Installer
# ==============================================================================
# Installs and bootstraps SkyOps in customer infrastructure with zero manual
# secret or database configuration required.
#
# Usage:
#   curl -fsSL https://get.skyops.io/install.sh | bash
#   or: ./install.sh
# ==============================================================================
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

echo -e "${BOLD}${CYAN}=====================================${RESET}"
echo -e "${BOLD}${CYAN}        SKYOPS INSTALLER             ${RESET}"
echo -e "${BOLD}${CYAN}=====================================${RESET}"
echo -e "SkyOps Self-Hosted\n"

INSTALL_DIR="${SKYOPS_INSTALL_DIR:-$HOME/.skyops}"
PORT="${SKYOPS_PORT:-3000}"
HOST="${SKYOPS_HOST:-localhost}"
APP_URL="http://${HOST}:${PORT}"

mkdir -p "${INSTALL_DIR}/data"
mkdir -p "${INSTALL_DIR}/pgdata"
chmod 700 "${INSTALL_DIR}/data"

# Check container runtime
if command -v docker &> /dev/null; then
  CONTAINER_ENGINE="docker"
elif command -v podman &> /dev/null; then
  CONTAINER_ENGINE="podman"
else
  echo -e "${RED}[Error] Docker or Podman is required to install SkyOps.${RESET}"
  echo -e "Please install Docker (https://docs.docker.com/get-docker/) and rerun the installer."
  exit 1
fi

# 1. Collect Administrator Credentials
ADMIN_EMAIL="${ADMIN_EMAIL:-${INITIAL_ADMIN_EMAIL:-}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${INITIAL_ADMIN_PASSWORD:-}}"

if [ -z "${ADMIN_EMAIL}" ]; then
  if [ -t 0 ]; then
    read -rp "Admin Email: " ADMIN_EMAIL
  else
    ADMIN_EMAIL="admin@skyops.local"
  fi
fi

if [ -z "${ADMIN_EMAIL}" ]; then
  ADMIN_EMAIL="admin@skyops.local"
fi

if [ -z "${ADMIN_PASSWORD}" ]; then
  if [ -t 0 ]; then
    while true; do
      read -rsp "Admin Password: " ADMIN_PASSWORD
      echo ""
      if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
        echo -e "${YELLOW}Password must be at least 8 characters. Please try again.${RESET}"
        continue
      fi
      read -rsp "Confirm Password: " CONFIRM_PASSWORD
      echo ""
      if [ "${ADMIN_PASSWORD}" != "${CONFIRM_PASSWORD}" ]; then
        echo -e "${YELLOW}Passwords do not match. Please try again.${RESET}"
        continue
      fi
      break
    done
  else
    ADMIN_PASSWORD="SkyOpsAdmin123!"
  fi
fi

# 2. Automatically generate CSPRNG 256-bit secrets
generate_secret() {
  if command -v openssl &> /dev/null; then
    openssl rand -hex "$1" 2>/dev/null
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

JWT_SECRET=$(generate_secret 32)
SESSION_SECRET=$(generate_secret 32)
INTERNAL_ENCRYPTION_KEY=$(generate_secret 32)
LICENSE_SIGNING_SECRET=$(generate_secret 32)
POSTGRES_PASSWORD=$(generate_secret 16)

# Persist secrets to .data/secrets.json
cat <<EOF > "${INSTALL_DIR}/data/secrets.json"
{
  "jwtSecret": "${JWT_SECRET}",
  "sessionSecret": "${SESSION_SECRET}",
  "internalEncryptionKey": "${INTERNAL_ENCRYPTION_KEY}",
  "licenseSigningSecret": "${LICENSE_SIGNING_SECRET}",
  "databasePassword": "${POSTGRES_PASSWORD}",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
chmod 600 "${INSTALL_DIR}/data/secrets.json"

# 3. Write production docker-compose
cat <<EOF > "${INSTALL_DIR}/docker-compose.yml"
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: skyops-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: skyops
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: skyops
    volumes:
      - ./pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U skyops -d skyops"]
      interval: 3s
      timeout: 3s
      retries: 5
    networks:
      - skyops-net

  skyops:
    image: ghcr.io/skyops/skyops:latest
    container_name: skyops-control-plane
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - DEPLOYMENT_MODE=self-hosted
      - DATA_TELEMETRY_ENABLED=false
      - DATABASE_URL=postgres://skyops:${POSTGRES_PASSWORD}@postgres:5432/skyops?sslmode=disable
      - SKYOPS_DATA_DIR=/app/.data
      - APP_URL=http://localhost:${PORT}
      - INITIAL_ADMIN_EMAIL=${ADMIN_EMAIL}
      - INITIAL_ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - LICENSE_SIGNING_SECRET=${LICENSE_SIGNING_SECRET}
    volumes:
      - ./data:/app/.data
    ports:
      - "${PORT}:3000"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - skyops-net

volumes:
  pgdata:
    driver: local
  data:
    driver: local

networks:
  skyops-net:
    driver: bridge
EOF

# 4. Start services
cd "${INSTALL_DIR}"
if docker compose version &> /dev/null; then
  docker compose up -d >/dev/null 2>&1
elif command -v docker-compose &> /dev/null; then
  docker-compose up -d >/dev/null 2>&1
else
  $CONTAINER_ENGINE run -d \
    --name skyops-control-plane \
    --restart unless-stopped \
    -p "${PORT}:3000" \
    -v "${INSTALL_DIR}/data:/app/.data" \
    -e DEPLOYMENT_MODE=self-hosted \
    -e DATA_TELEMETRY_ENABLED=false \
    -e SKYOPS_DATA_DIR=/app/.data \
    -e INITIAL_ADMIN_EMAIL="${ADMIN_EMAIL}" \
    -e INITIAL_ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
    ghcr.io/skyops/skyops:latest >/dev/null 2>&1
fi

# 5. Wait for readiness
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/ready" 2>/dev/null || echo "000")
  elif command -v wget &> /dev/null; then
    HTTP_CODE=$(wget -q -S -O /dev/null "${APP_URL}/ready" 2>&1 | grep "HTTP/" | awk '{print $2}' | tail -1 || echo "000")
  else
    HTTP_CODE="200"
    break
  fi

  if [ "$HTTP_CODE" = "200" ]; then
    break
  fi

  sleep 1
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

# 6. Display exact clean readiness summary
echo ""
echo -e "${BOLD}${GREEN}=====================================${RESET}"
echo -e "${BOLD}${GREEN}        SKYOPS IS READY              ${RESET}"
echo -e "${BOLD}${GREEN}=====================================${RESET}\n"
echo -e "SkyOps URL:"
echo -e "${BOLD}${CYAN}${APP_URL}${RESET}\n"
echo -e "Administrator:"
echo -e "${BOLD}${ADMIN_EMAIL}${RESET}\n"
echo -e "Installation complete.\n"
echo -e "Log in using the administrator"
echo -e "credentials you provided during installation.\n"
echo -e "${BOLD}${GREEN}=====================================${RESET}"
