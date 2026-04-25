import { IsDateString, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  locationId!: string;

  @IsString()
  leaveType!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @IsPositive()
  daysRequested!: number;
}
