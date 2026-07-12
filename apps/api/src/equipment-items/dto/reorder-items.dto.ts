import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderItemEntry {
  @ApiProperty({ description: 'Item ID' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'New sort order', example: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderItemsDto {
  @ApiProperty({ description: 'Array of items with new sort orders', type: [ReorderItemEntry] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemEntry)
  items!: ReorderItemEntry[];
}
