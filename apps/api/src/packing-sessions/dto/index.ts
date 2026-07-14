import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartPackingSessionDto {
  @ApiPropertyOptional({ description: 'Checklist to pack from (resolved automatically from activity if not provided)' })
  @IsOptional()
  @IsUUID()
  checklistId?: string;

  @ApiPropertyOptional({ description: 'Group activity ID for group packing sessions' })
  @IsOptional()
  @IsUUID()
  groupActivityId?: string;
}

export class RecordDecisionDto {
  @ApiPropertyOptional({ description: 'Equipment item ID (personal item)' })
  @IsOptional()
  @IsUUID()
  equipmentItemId?: string;

  @ApiPropertyOptional({ description: 'Shared item ID (group item)' })
  @IsOptional()
  @IsUUID()
  sharedItemId?: string;

  @ApiProperty({ enum: ['PACKED', 'NOT_PACKED', 'SKIPPED'] })
  @IsEnum(['PACKED', 'NOT_PACKED', 'SKIPPED'])
  decision!: 'PACKED' | 'NOT_PACKED' | 'SKIPPED';

  @ApiPropertyOptional({ enum: ['FORGOT', 'COULD_NOT_BRING', 'REPLACEMENT_ARRANGED', 'NOT_NEEDED'] })
  @IsOptional()
  @IsEnum(['FORGOT', 'COULD_NOT_BRING', 'REPLACEMENT_ARRANGED', 'NOT_NEEDED'])
  reason?: 'FORGOT' | 'COULD_NOT_BRING' | 'REPLACEMENT_ARRANGED' | 'NOT_NEEDED';

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListSessionsQueryDto {
  @ApiPropertyOptional({ enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'] })
  @IsOptional()
  @IsEnum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED'])
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
}
