import { ApiPropertyOptional } from '@nestjs/swagger';
import { GroupActivityStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';

export class ListGroupActivitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: GroupActivityStatus })
  @IsOptional()
  @IsEnum(GroupActivityStatus)
  status?: GroupActivityStatus;

  @ApiPropertyOptional({ description: 'Case-insensitive title or venue search' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
