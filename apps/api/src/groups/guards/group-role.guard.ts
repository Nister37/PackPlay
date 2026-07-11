import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppErrorCode } from '@packplay/common';

/**
 * Guard that verifies the user's group role matches one of the required roles.
 * Must be used after GroupMemberGuard (which attaches request.groupMember).
 */
@Injectable()
export class GroupRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const membership = request.groupMember;

    if (!membership) {
      throw new ForbiddenException({
        code: AppErrorCode.INSUFFICIENT_ROLE,
        message: 'Insufficient permissions',
      });
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException({
        code: AppErrorCode.INSUFFICIENT_ROLE,
        message: 'Insufficient permissions for this action',
      });
    }

    return true;
  }
}
