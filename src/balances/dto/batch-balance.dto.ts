import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchBalanceRecordDto {
  @IsString()
  employeeId!: string;

  @IsString()
  locationId!: string;

  @IsString()
  leaveType!: string;

  @IsNumber()
  balanceDays!: number;
}

export class BatchBalanceDto {
  @IsString()
  batchId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchBalanceRecordDto)
  records!: BatchBalanceRecordDto[];
}
