import { IsBoolean } from 'class-validator';

export class ToggleServiceStatusDto {
  @IsBoolean()
  is_active: boolean;
}