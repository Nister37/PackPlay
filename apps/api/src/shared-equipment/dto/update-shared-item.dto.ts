import { IsBoolean, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpdateSharedItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  requiredQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
