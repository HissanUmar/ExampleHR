import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRequestNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
