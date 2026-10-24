import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(100)
  declare name: string;

  @IsString()
  @MaxLength(100)
  declare slug: string;

  @IsOptional()
  @IsUUID()
  declare parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare icon?: string | null;

  @IsOptional()
  @IsString()
  declare description?: string | null;

  @IsOptional()
  @IsInt()
  declare sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  declare isActive?: boolean;
}
