import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupMemberGuard } from './guards/group-member.guard';
import { GroupRoleGuard } from './guards/group-role.guard';

@Module({
  controllers: [GroupsController],
  providers: [GroupsService, GroupMemberGuard, GroupRoleGuard],
  exports: [GroupsService],
})
export class GroupsModule {}
