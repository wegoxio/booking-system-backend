import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';

export class CreatePublicBookingDto extends CreateBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  captcha_token?: string;
}

