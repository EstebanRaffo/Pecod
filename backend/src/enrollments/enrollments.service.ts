import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  // HU2
  async enroll(courseId: string, student: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    // "No es posible inscribirse a un curso despublicado"
    if (!course.isPublished) {
      throw new BadRequestException('Este curso no está disponible para inscripción.');
    }

    // "El Alumno solo puede inscribirse a cursos de su institución"
    if (course.institutionId !== student.institutionId) {
      throw new BadRequestException('Solo podés inscribirte a cursos de tu institución.');
    }

    try {
      return await this.prisma.enrollment.create({
        data: { studentId: student.userId, courseId },
      });
    } catch (error: any) {
      // Constraint única (studentId, courseId) -> doble inscripción
      if (error.code === 'P2002') {
        throw new ConflictException('Ya estás inscripto en este curso.');
      }
      throw error;
    }
  }

  // HU3: "Mis cursos" - incluye cursos despublicados luego de la inscripción
  // (se marcan como no disponibles en el frontend según course.isPublished).
  myCourses(student: AuthenticatedUser) {
    return this.prisma.enrollment.findMany({
      where: { studentId: student.userId },
      include: { course: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
