import { IsIn, IsInt, IsNotEmpty, IsPositive } from 'class-validator';

export enum UploadKind {
  VIDEO = 'video',
  MATERIAL = 'material',
}

export class RequestUploadUrlDto {
  @IsNotEmpty()
  fileName: string;

  @IsNotEmpty()
  contentType: string; // ej: "video/mp4", "application/pdf"

  @IsInt()
  @IsPositive()
  sizeBytes: number;

  @IsIn([UploadKind.VIDEO, UploadKind.MATERIAL])
  kind: UploadKind;
}
