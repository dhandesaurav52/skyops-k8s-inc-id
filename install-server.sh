#!/usr/bin/env bash
# ==============================================================================
# SkyOps Control Plane - Self-Hosted Quick-Start Installer
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

ADMIN_EMAIL="${ADMIN_EMAIL:-${INITIAL_ADMIN_EMAIL:-admin@skyops.local}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${INITIAL_ADMIN_PASSWORD:-SkyOpsAdmin123!}}"

# Generate CSPRNG secrets
generate_secret() {
  if command -v openssl &> /dev/null; then
    openssl rand -hex "$1" 2>/dev/null
  else
    head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

JWT_SECRET=$(generate_secret 32)
SESSION_SECRET=$(generate_secret 32)
LICENSE_SIGNING_SECRET=$(generate_secret 32)

cat <<EOF > "${INSTALL_DIR}/data/secrets.json"
{
  "jwtSecret": "${JWT_SECRET}",
  "sessionSecret": "${SESSION_SECRET}",
  "licenseSigningSecret": "${LICENSE_SIGNING_SECRET}",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
chmod 600 "${INSTALL_DIR}/data/secrets.json"

cat <<EOF > "${INSTALL_DIR}/docker-compose.yml"
version: '3.8'

services:
  skyops:
    image: ghcr.io/skyops/skyops:latest
    container_name: skyops-control-plane
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DEPLOYMENT_MODE=self-hosted
      - DATA_TELEMETRY_ENABLED=false
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
  data:
    driver: local

networks:
  skyops-net:
    driver: bridge
EOF

cd "${INSTALL_DIR}"
if docker compose version &> /dev/null; then
  docker compose up -d >/dev/null 2>&1
elif command -v docker-compose &> /dev/null; then
  docker-compose up -d >/dev/null 2>&1
fi

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
