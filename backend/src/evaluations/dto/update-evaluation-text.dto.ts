import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class UpdateEvaluationTextDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  text!: string;
}