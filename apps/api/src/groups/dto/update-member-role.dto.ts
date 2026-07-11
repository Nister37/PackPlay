import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum GroupMemberRoleDto {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export class UpdateMemberRoleDto {
  @ApiProperty({ description: 'New role for the member', enum: GroupMemberRoleDto })
  @IsEnum(GroupMemberRoleDto)
  role!: GroupMemberRoleDto;
}
