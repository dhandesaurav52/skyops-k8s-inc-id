#!/usr/bin/env bash
# ==============================================================================
# SkyOps Self-Hosted Quick-Install Script
# ==============================================================================
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

echo -e "${BOLD}${CYAN}====================================================${RESET}"
echo -e "${BOLD}${CYAN}       SkyOps Control Plane Quick Installer         ${RESET}"
echo -e "${BOLD}${CYAN}====================================================${RESET}\n"

INSTALL_DIR="${SKYOPS_INSTALL_DIR:-$HOME/.skyops}"
PORT="${SKYOPS_PORT:-3000}"
HOST="${SKYOPS_HOST:-localhost}"
APP_URL="http://${HOST}:${PORT}"

echo -e "Target Directory: ${BOLD}${INSTALL_DIR}${RESET}"
mkdir -p "${INSTALL_DIR}/data"
mkdir -p "${INSTALL_DIR}/pgdata"

# 1. Check container engine
echo -e "\n${CYAN}[1/4] Checking prerequisites...${RESET}"
if command -v docker &> /dev/null; then
  CONTAINER_ENGINE="docker"
  echo -e "  ✓ Docker detected ($(docker --version | head -n1))"
elif command -v podman &> /dev/null; then
  CONTAINER_ENGINE="podman"
  echo -e "  ✓ Podman detected ($(podman --version | head -n1))"
else
  echo -e "${RED}[Error] Docker or Podman is required to run SkyOps Control Plane.${RESET}"
  echo -e "Please install Docker (https://docs.docker.com/get-docker/) and retry."
  exit 1
fi

# 2. Write docker-compose configuration
echo -e "\n${CYAN}[2/4] Generating deployment configuration...${RESET}"
cat <<'EOF' > "${INSTALL_DIR}/docker-compose.yml"
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: skyops-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: skyops
      POSTGRES_PASSWORD: skyops_secure_password
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
      - DATABASE_URL=postgres://skyops:skyops_secure_password@postgres:5432/skyops?sslmode=disable
      - SKYOPS_DATA_DIR=/app/.data
      - APP_URL=http://localhost:3000
    volumes:
      - ./data:/app/.data
    ports:
      - "3000:3000"
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

echo -e "  ✓ Configuration written to ${INSTALL_DIR}/docker-compose.yml"

# 3. Launch containers
echo -e "\n${CYAN}[3/4] Launching SkyOps services...${RESET}"
cd "${INSTALL_DIR}"

if docker compose version &> /dev/null; then
  docker compose up -d
elif command -v docker-compose &> /dev/null; then
  docker-compose up -d
else
  # Fallback to standalone container
  $CONTAINER_ENGINE run -d \
    --name skyops-control-plane \
    --restart unless-stopped \
    -p "${PORT}:3000" \
    -v "${INSTALL_DIR}/data:/app/.data" \
    -e DEPLOYMENT_MODE=self-hosted \
    -e DATA_TELEMETRY_ENABLED=false \
    -e SKYOPS_DATA_DIR=/app/.data \
    ghcr.io/skyops/skyops:latest
fi

# 4. Wait for readiness
echo -e "\n${CYAN}[4/4] Waiting for SkyOps Control Plane to become ready...${RESET}"
MAX_RETRIES=30
RETRY_COUNT=0
READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/ready" 2>/dev/null || echo "000")
  elif command -v wget &> /dev/null; then
    HTTP_CODE=$(wget -q -S -O /dev/null "${APP_URL}/ready" 2>&1 | grep "HTTP/" | awk '{print $2}' | tail -1 || echo "000")
  else
    HTTP_CODE="200"
    break
  fi

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "503" ]; then
    READY=true
    break
  fi

  sleep 1
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo -n "."
done
echo ""

echo -e "\n${BOLD}${GREEN}====================================================${RESET}"
echo -e "${BOLD}${GREEN}   SkyOps is ready.                                 ${RESET}"
echo -e "${BOLD}${GREEN}====================================================${RESET}\n"
echo -e "Open the URL in your browser and complete first-time setup:\n"
echo -e "  👉  ${BOLD}${CYAN}${APP_URL}${RESET}\n"
echo -e "• Deployment Mode:   ${BOLD}Self-Hosted${RESET}"
echo -e "• Privacy Status:    ${BOLD}Telemetry Disabled (Strict Local)${RESET}"
echo -e "• Secrets Storage:   ${BOLD}${INSTALL_DIR}/data/secrets.json${RESET}"
echo -e "• Health Endpoint:   ${BOLD}${APP_URL}/health${RESET}"
echo -e "• Readiness Probe:   ${BOLD}${APP_URL}/ready${RESET}\n"
