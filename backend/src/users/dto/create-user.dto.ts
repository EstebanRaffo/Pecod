import { IsEmail, IsIn, IsNotEmpty, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';

// HU9: al dar de alta un Profesor o Alumno se completa nombre, email y rol,
// y queda vinculado a la institución correspondiente.
export class CreateUserDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  name: string;

  @IsEmail({}, { message: 'El email no tiene un formato válido.' })
  email: string;

  @IsIn([Role.PROFESSOR, Role.STUDENT], {
    message: 'El rol debe ser PROFESSOR o STUDENT (el rol ADMIN no se crea por este medio).',
  })
  role: Role;

  @IsUUID('4', { message: 'institutionId debe ser un UUID válido.' })
  institutionId: string;
}
