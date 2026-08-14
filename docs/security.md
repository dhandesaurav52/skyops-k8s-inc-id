# SkyOps Security & Cryptography Model

SkyOps is built with a zero-trust, privacy-first security architecture for Kubernetes operational intelligence.

---

## 1. Secret Precedence and Lifecycle

Internal secrets follow a strict 3-tier resolution hierarchy:

```
┌─────────────────────────────────────────────────────────┐
│ 1. Explicit Operator Environment Variable               │
└───────────────────────────┬─────────────────────────────┘
                            │ (If not provided)
┌───────────────────────────▼─────────────────────────────┐
│ 2. Persisted Secrets File (.data/secrets.json)          │
└───────────────────────────┬─────────────────────────────┘
                            │ (If not found)
┌───────────────────────────▼─────────────────────────────┐
│ 3. Cryptographically Generated (256-bit CSPRNG Entropy) │
└─────────────────────────────────────────────────────────┘
```

### Key Security Principles:
- **Never Overwrite**: Existing secrets in `.data/secrets.json` or environment variables are never overwritten.
- **Stable Identity**: Cryptographic tokens remain identical across container restarts and upgrades.
- **Zero Exposure**: Raw secrets are never printed to console logs, included in public API responses, or displayed in the frontend.

---

## 2. Token Cryptography & Verification

- **User Authentication**: Signed with HMAC-SHA256 (HS256) using a 256-bit secret.
- **Cluster Tokens**: Unique 256-bit hex tokens per Kubernetes cluster. Tokens can be rotated on demand via `POST /api/v1/clusters/:id/rotate-token`.
- **License Keys**: Cryptographically signed offline with HMAC-SHA256. Verified entirely on-premise without external telemetry callback.

---

## 3. RBAC Privileges

| Role | Cluster Management | Incident Triage & RCA | Ticketing & Tasks | User Directory |
| :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | Full (Create, Rotate, Delete) | Full | Full | Full (Add, Update, Delete) |
| **SRE** | Read-Only | Full (Acknowledge, Resolve) | Full (Edit, Tasks, Assign) | Read-Only |
| **DEVELOPER** | Read-Only | Read & AI Diagnose | Comment & View | None |
| **VIEWER** | Read-Only | Read-Only | Read-Only | None |
