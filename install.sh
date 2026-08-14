#!/usr/bin/env bash
# ==============================================================================
# SkyOps Primary One-Line Installer
# ==============================================================================
# Primary customer-facing installation experience:
#   curl -fsSL https://get.skyops.io/install.sh | bash
#
# Idempotent:
#   - Fresh install: sets up directories, secrets, bundled postgres (if needed),
#     and prints the single one-time initial administrator password.
#   - Upgrade/Existing: preserves existing data, secrets, users, clusters, and
#     refuses to regenerate or overwrite credentials.
# ==============================================================================
set -euo pipefail

# 1. Formatting & Colors
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
DIM='\033[2m'
RESET='\033[0m'

# 2. Environment & System Detection
detect_os() {
  case "$(uname -s)" in
    Linux*)   echo "linux" ;;
    Darwin*)  echo "darwin" ;;
    *)        echo "unsupported" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64)   echo "amd64" ;;
    aarch64|arm64)  echo "arm64" ;;
    *)              echo "unsupported" ;;
  esac
}

OS_TYPE=$(detect_os)
ARCH_TYPE=$(detect_arch)

if [ "$OS_TYPE" = "unsupported" ]; then
  echo -e "${RED}[Error] Unsupported operating system. SkyOps runs on Linux and macOS.${RESET}" >&2
  exit 1
fi

# Detect server IP for clean URL display
detect_server_ip() {
  if command -v hostname &>/dev/null && hostname -I &>/dev/null; then
    hostname -I | awk '{print $1}'
  elif command -v ip &>/dev/null; then
    ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -n1
  else
    echo "localhost"
  fi
}

SERVER_IP="${SKYOPS_HOST:-$(detect_server_ip)}"
[ -z "$SERVER_IP" ] && SERVER_IP="localhost"
PORT="${SKYOPS_PORT:-3000}"
APP_URL="http://${SERVER_IP}:${PORT}"

INSTALL_DIR="${SKYOPS_INSTALL_DIR:-$HOME/.skyops}"
DATA_DIR="${INSTALL_DIR}/data"
SECRETS_DIR="${DATA_DIR}/secrets"
PGDATA_DIR="${INSTALL_DIR}/pgdata"

mkdir -p "${INSTALL_DIR}"
mkdir -p "${DATA_DIR}"
mkdir -p "${SECRETS_DIR}"
mkdir -p "${PGDATA_DIR}"
chmod 700 "${INSTALL_DIR}" "${DATA_DIR}" "${SECRETS_DIR}" "${PGDATA_DIR}"

# 3. Check for Container Runtime or Node Runtime
CONTAINER_ENGINE=""
if command -v docker &> /dev/null; then
  CONTAINER_ENGINE="docker"
elif command -v podman &> /dev/null; then
  CONTAINER_ENGINE="podman"
fi

# CSPRNG helper function (uses OpenSSL or /dev/urandom)
generate_secret() {
  local length="$1"
  if command -v openssl &> /dev/null; then
    openssl rand -hex "$length" 2>/dev/null
  else
    head -c "$length" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

# 4. Detect Existing Installation
SECRETS_FILE="${DATA_DIR}/secrets.json"
PASSWORD_FILE="${SECRETS_DIR}/initial-admin-password"
IS_EXISTING_INSTALL=false
IS_INITIALIZED=false

if [ -f "${SECRETS_FILE}" ]; then
  IS_EXISTING_INSTALL=true
  # If the one-time initial-admin-password file has already been deleted, setup is complete
  if [ ! -f "${PASSWORD_FILE}" ]; then
    IS_INITIALIZED=true
  fi
fi

INITIAL_ADMIN_PASSWORD=""

if [ "$IS_EXISTING_INSTALL" = false ]; then
  # 5. Fresh Installation: Generate 256-bit secrets & one-time bootstrap password
  JWT_SECRET=$(generate_secret 32)
  SESSION_SECRET=$(generate_secret 32)
  INTERNAL_ENCRYPTION_KEY=$(generate_secret 32)
  LICENSE_SIGNING_SECRET=$(generate_secret 32)
  POSTGRES_PASSWORD=$(generate_secret 16)

  cat <<EOF > "${SECRETS_FILE}"
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
  chmod 600 "${SECRETS_FILE}"

  # Generate 192-bit CSPRNG one-time initial administrator password
  BOOTSTRAP_HEX=$(generate_secret 24)
  INITIAL_ADMIN_PASSWORD="SKYOPS-${BOOTSTRAP_HEX}"
  echo "${INITIAL_ADMIN_PASSWORD}" > "${PASSWORD_FILE}"
  chmod 600 "${PASSWORD_FILE}"

else
  # Read existing DB password from secrets.json if present
  if [ -f "${SECRETS_FILE}" ]; then
    POSTGRES_PASSWORD=$(grep -o '"databasePassword": *"[^"]*"' "${SECRETS_FILE}" | cut -d'"' -f4 || echo "skyops_secure_password")
  else
    POSTGRES_PASSWORD="skyops_secure_password"
  fi

  if [ -f "${PASSWORD_FILE}" ]; then
    INITIAL_ADMIN_PASSWORD=$(cat "${PASSWORD_FILE}" | tr -d ' \n\r')
  fi
fi

# 6. Generate/Update docker-compose.yml configuration
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

# 7. Start / Restart SkyOps Services
if [ -n "$CONTAINER_ENGINE" ]; then
  cd "${INSTALL_DIR}"
  if docker compose version &> /dev/null; then
    docker compose up -d >/dev/null 2>&1 || true
  elif command -v docker-compose &> /dev/null; then
    docker-compose up -d >/dev/null 2>&1 || true
  fi
fi

# 8. Wait for Readiness Endpoint (non-blocking fallback)
if [ "${SKYOPS_SKIP_WAIT:-0}" != "1" ] && [ -n "$CONTAINER_ENGINE" ]; then
  MAX_RETRIES=30
  RETRY_COUNT=0
  IS_READY=false

  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if command -v curl &> /dev/null; then
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/ready" 2>/dev/null || echo "000")
    elif command -v wget &> /dev/null; then
      HTTP_CODE=$(wget -q -S -O /dev/null "http://127.0.0.1:${PORT}/ready" 2>&1 | grep "HTTP/" | awk '{print $2}' | tail -1 || echo "000")
    else
      HTTP_CODE="200"
    fi

    if [ "$HTTP_CODE" = "200" ]; then
      IS_READY=true
      break
    fi

    sleep 1
    RETRY_COUNT=$((RETRY_COUNT + 1))
  done
fi

# 9. Terminal Output Experience
if [ "$IS_INITIALIZED" = true ]; then
  # System already initialized; upgrade complete
  echo ""
  echo -e "${BOLD}${CYAN}==================================================${RESET}"
  echo -e "${BOLD}${GREEN}             SKYOPS UPDATED                       ${RESET}"
  echo -e "${BOLD}${CYAN}==================================================${RESET}"
  echo ""
  echo -e "SkyOps Control Plane is up to date and ready."
  echo ""
  echo -e "${BOLD}URL:${RESET}"
  echo -e "${CYAN}${APP_URL}${RESET}"
  echo ""
  echo -e "All existing data, users, and cluster connections preserved."
  echo ""
  echo -e "${BOLD}${CYAN}==================================================${RESET}"
  echo ""

else
  # Fresh Installation / Pending First Launch
  echo ""
  echo -e "${BOLD}${CYAN}==================================================${RESET}"
  echo -e "${BOLD}${GREEN}             SKYOPS INSTALLED                     ${RESET}"
  echo -e "${BOLD}${CYAN}==================================================${RESET}"
  echo ""
  echo -e "SkyOps Control Plane is ready."
  echo ""
  echo -e "${BOLD}URL:${RESET}"
  echo -e "${BOLD}${CYAN}${APP_URL}${RESET}"
  echo ""
  echo -e "${BOLD}Initial Administrator Password:${RESET}"
  echo ""
  echo -e "${BOLD}${GREEN}${INITIAL_ADMIN_PASSWORD}${RESET}"
  echo ""
  echo -e "${BOLD}${YELLOW}IMPORTANT:${RESET}"
  echo -e "This is a one-time bootstrap password."
  echo ""
  echo -e "Use it to unlock SkyOps in your browser."
  echo ""
  echo -e "After you create your permanent administrator"
  echo -e "account, this password will be permanently"
  echo -e "invalidated and will not be displayed again."
  echo ""
  echo -e "Save it securely before continuing."
  echo ""
  echo -e "${BOLD}${CYAN}==================================================${RESET}"
  echo ""
fi
