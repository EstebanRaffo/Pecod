import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { SimulatedPaymentProcessor } from './simulated-payment-processor';
import { IPaymentProcessor } from './interfaces/payment-processor.interface';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly processor: IPaymentProcessor;

  constructor(private prisma: PrismaService) {
    this.processor = new SimulatedPaymentProcessor();
  }

  // HU26: Procesar pago y crear inscripción en transacción atómica
  async processPayment(
    courseId: string,
    createPaymentDto: CreatePaymentDto,
    student: AuthenticatedUser,
  ) {
    // Verificar que el estudiante tenga rol STUDENT
    if (student.role !== 'STUDENT') {
      throw new ForbiddenException('Solo los estudiantes pueden realizar pagos.');
    }

    // Obtener curso
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Curso no encontrado.');
    }

    // HU26: Verificar que el curso tenga precio > 0
    const coursePrice = course.price;
    if (!coursePrice || (typeof coursePrice === 'object' && coursePrice.lessThanOrEqualTo(0))) {
      throw new BadRequestException('Este curso es gratuito y no requiere pago.');
    }

    // HU2: Verificar que el curso esté publicado
    if (!course.isPublished) {
      throw new BadRequestException('Este curso no está disponible para inscripción.');
    }

    // HU2: Verificar que sea de la misma institución del estudiante
    if (course.institutionId !== student.institutionId) {
      throw new ForbiddenException('Solo podés inscribirte a cursos de tu institución.');
    }

    // HU26: Verificar que el estudiante no esté ya inscripto
    const existingEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId: student.userId,
        courseId,
      },
    });

    if (existingEnrollment) {
      throw new ConflictException('Ya estás inscripto en este curso.');
    }

    // HU26: Verificar que no haya un pago aprobado previo (evita intento de doble pago)
    const existingApprovedPayment = await this.prisma.payment.findFirst({
      where: {
        studentId: student.userId,
        courseId,
        status: 'APPROVED',
      },
    });

    if (existingApprovedPayment) {
      // Idempotencia: si ya hay pago aprobado, devolver resultado como si fue exitoso
      // pero en realidad la inscripción ya debería existir
      return {
        status: 'APPROVED',
        message: 'Ya has pagado este curso.',
        paymentId: existingApprovedPayment.id,
      };
    }

    // Procesar pago con el procesador
    const paymentResult = await this.processor.processPayment(
      createPaymentDto.cardNumber,
      createPaymentDto.holderName,
      createPaymentDto.expiry,
      createPaymentDto.cvv,
      coursePrice,
    );

    // Ejecutar transacción atómica: crear Payment y (si aprobado) crear Enrollment
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Crear registro de pago
        const payment = await tx.payment.create({
          data: {
            studentId: student.userId,
            courseId,
            amount: coursePrice,
            currency: 'ARS',
            status: paymentResult.status as any,
            rejectionReason: paymentResult.rejectionReason || null,
            cardBrand: paymentResult.cardBrand,
            cardLast4: paymentResult.cardLast4,
          },
        });

        // Si el pago fue aprobado, crear inscripción
        if (paymentResult.status === 'APPROVED') {
          const enrollment = await tx.enrollment.create({
            data: {
              studentId: student.userId,
              courseId,
            },
            include: {
              course: true,
              student: true,
            },
          });

          return {
            payment,
            enrollment,
            status: 'APPROVED',
          };
        }

        return {
          payment,
          status: 'REJECTED',
        };
      });

      return {
        status: result.status,
        paymentId: result.payment.id,
        rejectionReason: result.payment.rejectionReason,
        message:
          result.status === 'APPROVED'
            ? 'Pago aprobado. Te has inscripto al curso.'
            : `Pago rechazado: ${result.payment.rejectionReason}`,
      };
    } catch (error: any) {
      // HU26: Si hay error de constraint única (doble pago aprobado), es idempotencia
      if (error.code === 'P2002') {
        // Buscar el pago aprobado existente y devolverlo
        const existingPayment = await this.prisma.payment.findFirst({
          where: {
            studentId: student.userId,
            courseId,
            status: 'APPROVED',
          },
        });

        if (existingPayment) {
          return {
            status: 'APPROVED',
            paymentId: existingPayment.id,
            message: 'Ya has pagado este curso.',
          };
        }
      }

      throw error;
    }
  }

  // HU26: Obtener historial de pagos (opcional, para auditoría)
  async getPaymentHistory(student: AuthenticatedUser) {
    return this.prisma.payment.findMany({
      where: { studentId: student.userId },
      include: {
        course: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
