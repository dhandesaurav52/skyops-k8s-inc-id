export interface SystemDeploymentInfo {
  mode: 'self-hosted' | 'cloud';
  version: string;
  dataTelemetryEnabled: boolean;
  privacyMode: 'STRICT_LOCAL' | 'ANONYMIZED_TELEMETRY';
  database: {
    type: 'postgres' | 'memory';
    healthy: boolean;
    details?: string;
  };
  limits: {
    maxClusters: number;
    maxUsers: number;
    plan: string;
  };
}

export function isDataTelemetryEnabled(): boolean {
  // In self-hosted mode, data telemetry is strictly FALSE by default
  const mode = process.env.DEPLOYMENT_MODE || 'self-hosted';
  if (mode === 'self-hosted') {
    return process.env.DATA_TELEMETRY_ENABLED === 'true';
  }
  return true;
}

export function getDeploymentMode(): 'self-hosted' | 'cloud' {
  return (process.env.DEPLOYMENT_MODE as 'self-hosted' | 'cloud') || 'self-hosted';
}

export function sanitizePayloadForTelemetry<T extends Record<string, any>>(payload: T): Partial<T> {
  const sensitiveKeys = ['token', 'password', 'secret', 'key', 'credential', 'auth', 'jwt'];
  const sanitized: Record<string, any> = {};

  for (const [k, v] of Object.entries(payload)) {
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      continue; // Filter out sensitive fields
    }
    sanitized[k] = v;
  }

  return sanitized as Partial<T>;
}

