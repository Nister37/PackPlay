import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required group roles for an endpoint.
 * Use with GroupRoleGuard.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
