#!/usr/bin/env bash
set -e

# ==============================================================================
# SkyOps Control Plane - Self-Hosted Automated Quick-Start Installer
# ==============================================================================
# This script sets up and launches the self-hosted SkyOps control plane with
# zero-configuration required. All cryptographic tokens & database parameters
# are provisioned and persisted automatically.
#
# Usage:
#   curl -fsSL https://get.skyops.io/server.sh | bash
# ==============================================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

echo -e "${BOLD}${CYAN}====================================================${RESET}"
echo -e "${BOLD}${CYAN}   SkyOps Control Plane Quick-Start Installer       ${RESET}"
echo -e "${BOLD}${CYAN}====================================================${RESET}\n"

INSTALL_DIR="${SKYOPS_INSTALL_DIR:-$HOME/.skyops}"
PORT="${SKYOPS_PORT:-3000}"

echo -e "Installing SkyOps in: ${BOLD}${INSTALL_DIR}${RESET}"
mkdir -p "$INSTALL_DIR/data"

# Check for Docker or Podman
if command -v docker &> /dev/null; then
  CONTAINER_ENGINE="docker"
elif command -v podman &> /dev/null; then
  CONTAINER_ENGINE="podman"
else
  echo -e "${RED}[Error] Docker or Podman is required to run SkyOps Control Plane.${RESET}"
  echo -e "Please install Docker (https://docs.docker.com/get-docker/) and retry."
  exit 1
fi

echo -e "${CYAN}[1/3] Setting up docker-compose configuration...${RESET}"

cat <<'EOF' > "$INSTALL_DIR/docker-compose.yml"
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
      - APP_URL=http://localhost:3000
    volumes:
      - ./data:/app/.data
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
EOF

echo -e "${CYAN}[2/3] Launching SkyOps Control Plane container...${RESET}"
cd "$INSTALL_DIR"

if command -v docker-compose &> /dev/null; then
  docker-compose up -d
elif docker compose version &> /dev/null; then
  docker compose up -d
else
  $CONTAINER_ENGINE run -d \
    --name skyops-control-plane \
    --restart unless-stopped \
    -p "${PORT}:3000" \
    -v "$INSTALL_DIR/data:/app/.data" \
    -e DEPLOYMENT_MODE=self-hosted \
    -e DATA_TELEMETRY_ENABLED=false \
    -e SKYOPS_DATA_DIR=/app/.data \
    ghcr.io/skyops/skyops:latest
fi

echo -e "${CYAN}[3/3] Verifying SkyOps status...${RESET}"
sleep 3

echo -e "\n${BOLD}${GREEN}====================================================${RESET}"
echo -e "${BOLD}${GREEN}   SkyOps Control Plane is Ready!                   ${RESET}"
echo -e "${BOLD}${GREEN}====================================================${RESET}\n"
echo -e "Open your browser to complete first-run setup:"
echo -e "  👉  ${BOLD}${CYAN}http://localhost:${PORT}${RESET}\n"
echo -e "• Deployment Mode:   ${BOLD}Self-Hosted (Strict Local Privacy)${RESET}"
echo -e "• Secrets Storage:   ${BOLD}${INSTALL_DIR}/data/secrets.json${RESET}"
echo -e "• Telemetry:         ${BOLD}Disabled (Air-Gap Capable)${RESET}"
echo -e "• Health Check:      ${BOLD}http://localhost:${PORT}/health${RESET}\n"
echo -e "To view live logs:   ${YELLOW}cd $INSTALL_DIR && docker compose logs -f${RESET}\n"
