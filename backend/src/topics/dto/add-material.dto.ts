import { IsIn, IsInt, IsNotEmpty, IsPositive, Max } from 'class-validator';

const MAX_MATERIAL_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (HU7)
const SUPPORTED_TYPES = ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'txt'];

// HU7: adjuntar material teórico (PDF, Excel, Word, TXT), máx. 10 MB.
export class AddMaterialDto {
  @IsNotEmpty()
  fileName: string;

  @IsNotEmpty()
  fileUrl: string;

  @IsIn(SUPPORTED_TYPES, {
    message: `Formato no soportado. Formatos válidos: ${SUPPORTED_TYPES.join(', ')}.`,
  })
  fileType: string;

  @IsInt()
  @IsPositive()
  @Max(MAX_MATERIAL_SIZE_BYTES, { message: 'El archivo supera el tamaño máximo de 10 MB.' })
  sizeBytes: number;
}
