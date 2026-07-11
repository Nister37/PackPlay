import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AppErrorCode } from '@packplay/common';

/**
 * Guard that verifies the requesting user is a member of the group
 * specified by the :groupId route parameter.
 * Attaches the membership record to request.groupMember.
 */
@Injectable()
export class GroupMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const groupId = request.params?.groupId;

    if (!userId || !groupId) {
      throw new ForbiddenException({
        code: AppErrorCode.NOT_A_MEMBER,
        message: 'Access denied',
      });
    }

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException({
        code: AppErrorCode.GROUP_NOT_FOUND,
        message: 'Group not found',
      });
    }

    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException({
        code: AppErrorCode.NOT_A_MEMBER,
        message: 'You are not a member of this group',
      });
    }

    request.groupMember = membership;
    return true;
  }
}
