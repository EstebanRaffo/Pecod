import { Type } from 'class-transformer';
import { ArrayMinSize, IsUUID, ValidateNested } from 'class-validator';

class AnswerInputDto {
  @IsUUID('4')
  questionId: string;

  @IsUUID('4')
  selectedOptionId: string;
}

export class SubmitAttemptDto {
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  @ArrayMinSize(1)
  answers: AnswerInputDto[];
}
