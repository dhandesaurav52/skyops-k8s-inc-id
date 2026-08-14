# SkyOps Self-Hosted Deployment Guide

SkyOps Self-Hosted provides single-tenant, air-gapped Kubernetes incident intelligence, RCA diagnostics, and SRE ticketing inside your private VPC or on-premise infrastructure.

---

## 1. Quick Start

Run the automated installer on your server:

```bash
curl -fsSL https://get.skyops.io/install.sh | bash
```

Then:
1. Open the provided URL (default `http://localhost:3000`).
2. Complete the 4-step first-run setup wizard.
3. Log in with your new administrator credentials.
4. Click **Connect Cluster** to generate an agent registration token.
5. Run the agent installer command on your Kubernetes cluster.
6. Verify the cluster status changes to **CONNECTED** and begin triage.

---

## 2. Zero-Configuration Security Architecture

Normal self-hosted installations configure all internal dependencies automatically:

- **Cryptographic Entropy**: 256-bit CSPRNG tokens for JWTs, session cookies, and database passwords.
- **Persistence**: Secrets are stored with permissions `0600` at `.data/secrets.json` (`$SKYOPS_DATA_DIR`).
- **Restart Stability**: Secrets are preserved across container updates and restarts; existing secrets are never overwritten.
- **No Secret Leakage**: Raw secret values are never printed to terminal logs, returned by APIs, or displayed in the UI.

---

## 3. Database Architecture

### Bundled PostgreSQL (Default)
Docker Compose and Helm provision high-availability PostgreSQL with persistent storage volumes and startup health checks. No manual database creation or migration steps are required.

### External PostgreSQL (Advanced Enterprise)
For organizations using managed database instances (AWS Aurora, GCP Cloud SQL, Azure Database for PostgreSQL):

```env
DATABASE_URL=postgres://skyops_user:password@pg-primary.internal:5432/skyops?sslmode=require
```

Or individual variables:
```env
DB_HOST=pg-primary.internal
DB_PORT=5432
DB_NAME=skyops
DB_USER=skyops_user
DB_PASSWORD=your_secure_password
```

---

## 4. Privacy and Air-Gap Compliance

- `DATA_TELEMETRY_ENABLED` defaults to `false`.
- All operational telemetry, pod logs, Kubernetes events, and incident diagnostic transcripts remain strictly inside your network perimeter.
- AI RCA diagnostics use local heuristic correlation algorithms or server-side proxied Gemini models with pre-sanitized payloads.
