import { Role } from '../db/types';

export type Permission =
  | 'manage:org'
  | 'manage:users'
  | 'manage:license'
  | 'manage:clusters'
  | 'connect:cluster'
  | 'rotate:tokens'
  | 'manage:incidents'
  | 'diagnose:incidents'
  | 'manage:tickets'
  | 'comment:tickets'
  | 'view:telemetry'
  | 'view:audit'
  | 'inject:demo';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    'manage:org',
    'manage:users',
    'manage:license',
    'manage:clusters',
    'connect:cluster',
    'rotate:tokens',
    'manage:incidents',
    'diagnose:incidents',
    'manage:tickets',
    'comment:tickets',
    'view:telemetry',
    'view:audit',
    'inject:demo',
  ],
  SRE: [
    'manage:clusters',
    'connect:cluster',
    'rotate:tokens',
    'manage:incidents',
    'diagnose:incidents',
    'manage:tickets',
    'comment:tickets',
    'view:telemetry',
    'view:audit',
    'inject:demo',
  ],
  DEVELOPER: [
    'diagnose:incidents',
    'manage:tickets',
    'comment:tickets',
    'view:telemetry',
    'view:audit',
  ],
  VIEWER: [
    'view:telemetry',
    'view:audit',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function isRoleAtLeast(userRole: Role, requiredRole: Role): boolean {
  const hierarchy: Record<Role, number> = {
    ADMIN: 4,
    SRE: 3,
    DEVELOPER: 2,
    VIEWER: 1,
  };
  return (hierarchy[userRole] || 0) >= (hierarchy[requiredRole] || 0);
}
