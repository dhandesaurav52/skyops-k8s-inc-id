# SkyOps Cloud Deployment Guide

SkyOps Cloud mode provides multi-tenant orchestration for managed SaaS deployments.

---

## 1. Cloud Mode Configuration

Enable cloud mode by configuring the deployment environment:

```env
DEPLOYMENT_MODE=cloud
DATA_TELEMETRY_ENABLED=true
DATABASE_URL=postgres://cloud_master:secure_pwd@managed-pg.cloud.provider:5432/skyops?sslmode=require
```

---

## 2. Customer Experience in Cloud Mode

In Cloud mode, users register and onboard through standard SaaS workflows:

1. **Sign Up / SSO**: User registers or authenticates via corporate Google Workspace, Okta, or Azure AD SAML/OIDC.
2. **Create Organization**: User creates or is invited to a workspace tenant.
3. **Dashboard Access**: Instantly land on the SkyOps multi-tenant dashboard.
4. **Connect Cluster**: Deploy the SkyOps agent to their remote Kubernetes clusters.

The cloud user is never exposed to database configuration, internal secrets, or server lifecycle parameters.

---

## 3. Multi-Tenancy & Isolation

- **Tenant Boundary**: All database queries, incidents, tickets, cluster tokens, and audit logs are partitioned by `organization_id`.
- **Stateless Scaling**: Control plane instances scale horizontally behind a load balancer with centralized PostgreSQL.
- **Probes**:
  - Liveness: `/health`
  - Readiness: `/ready`
  - Metrics: `/metrics` (Prometheus)
