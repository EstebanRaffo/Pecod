import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentsService } from './payments.service';
import { createMockPrismaService } from '../test-utils/mock-prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaService: any;
  let mockPrisma: any;
  let futureExpiry: string;

  const mockStudent: AuthenticatedUser = {
    userId: 'student-1',
    email: 'student@test.com',
    role: 'STUDENT',
    institutionId: 'inst-1',
  };

  const mockProfessor: AuthenticatedUser = {
    userId: 'professor-1',
    email: 'prof@test.com',
    role: 'PROFESSOR',
    institutionId: 'inst-1',
  };

  const mockCourse = {
    id: 'course-1',
    name: 'Test Course',
    institutionId: 'inst-1',
    professorId: 'professor-1',
    price: new Decimal('100.00'),
    isPublished: true,
    description: 'Test',
    category: 'Tech',
  };

  const mockFreeCourse = {
    ...mockCourse,
    price: null,
  };

  const mockUnpublishedCourse = {
    ...mockCourse,
    isPublished: false,
  };

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    // Calcular fecha futura
    const now = new Date();
    let month = now.getMonth() + 1;
    let year = now.getFullYear() + 2;
    if (month === 12) {
      month = 1;
      year += 1;
    } else {
      month += 1;
    }
    futureExpiry = `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('processPayment', () => {
    describe('validaciones de acceso', () => {
      it('HU26: debe rechazar si el usuario no es estudiante', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(mockCourse);

        const dto: CreatePaymentDto = {
          cardNumber: '4242424242424242',
          holderName: 'Test User',
          expiry: futureExpiry,
          cvv: '123',
        };

        await expect(
          service.processPayment('course-1', dto, mockProfessor),
        ).rejects.toThrow(ForbiddenException);
      });

      it('HU26: debe rechazar si el curso no existe', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(null);

        const dto: CreatePaymentDto = {
          cardNumber: '4242424242424242',
          holderName: 'Test User',
          expiry: futureExpiry,
          cvv: '123',
        };

        await expect(
          service.processPayment('invalid-course', dto, mockStudent),
        ).rejects.toThrow(NotFoundException);
      });

      it('HU26: debe rechazar si el curso es gratuito', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(mockFreeCourse);

        const dto: CreatePaymentDto = {
          cardNumber: '4242424242424242',
          holderName: 'Test User',
          expiry: futureExpiry,
          cvv: '123',
        };

        await expect(
          service.processPayment('course-1', dto, mockStudent),
        ).rejects.toThrow(BadRequestException);
      });

      it('HU26: debe rechazar si el curso no está publicado', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(mockUnpublishedCourse);

        const dto: CreatePaymentDto = {
          cardNumber: '4242424242424242',
          holderName: 'Test User',
          expiry: futureExpiry,
          cvv: '123',
        };

        await expect(
          service.processPayment('course-1', dto, mockStudent),
        ).rejects.toThrow(BadRequestException);
      });

      it('HU26: debe rechazar si el curso es de otra institución', async () => {
        const otherInstitutionCourse = {
          ...mockCourse,
          institutionId: 'other-inst',
        };
        mockPrisma.course.findUnique.mockResolvedValue(otherInstitutionCourse);

        const dto: CreatePaymentDto = {
          cardNumber: '4242424242424242',
          holderName: 'Test User',
          expiry: futureExpiry,
          cvv: '123',
        };

        await expect(
          service.processPayment('course-1', dto, mockStudent),
        ).rejects.toThrow(ForbiddenException);
      });

      it('HU26: debe rechazar si el estudiante ya está inscripto', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
        mockPrisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-1' });

        const dto: CreatePaymentDto = {
          cardNumber: '4242424242424242',
          holderName: 'Test User',
          expiry: futureExpiry,
          cvv: '123',
        };

        await expect(
          service.processPayment('course-1', dto, mockStudent),
        ).rejects.toThrow(ConflictException);
      });
    });

    describe('tarjeta de prueba: 4242 4242 4242 4242 (aprobado)', () => {
      it('HU26: debe procesar pago aprobado correctamente', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
        mockPrisma.enrollment.findFirst.mockResolvedValue(null);
        mockPrisma.payment.findFirst.mockResolvedValue(null);

        const mockPayment = {
          id: 'payment-1',
          status: 'APPROVED',
          cardBrand: 'VISA',
          cardLast4: '4242',
          amount: mockCourse.price,
        };

        const mockEnrollment = {
          id: 'enrollment-1',
          studentId: mockStudent.userId,
          courseId: 'course-1',
          course: mockCourse,
          student: { id: mockStudent.userId },
        };

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const payment = await callback(mockPrisma);
          return payment;
        });

        mockPrisma.payment.create.mockResolvedValue(mockPayment);
        mockPrisma.enrollment.create.mockResolvedValue(mockEnrollment);

        const dto: CreatePaymentDto = {
          cardNumber: '4242 4242 4242 4242',
          holderName: 'Test User',
          expiry: futureExpiry,
          cvv: '123',
        };

        const result = await service.processPayment('course-1', dto, mockStudent);

        expect(result.status).toBe('APPROVED');
        expect(result.message).toContain('inscripto');
        expect(mockPrisma.payment.create).toHaveBeenCalled();
        expect(mockPrisma.enrollment.create).toHaveBeenCalled();
      });
    });

    describe('tarjeta de prueba: 4000 0000 0000 9995 (fondos insuficientes)', () => {
      it('HU26: debe rechazar pago con mensaje de fondos insuficientes', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
        mockPrisma.enrollment.findFirst.mockResolvedValue(null);
        mockPrisma.payment.findFirst.mockResolvedValue(null);

        const mockPayment = {
          id: 'payment-2',
          status: 'REJECTED',
          rejectionReason: 'Fondos insuficientes.',
          cardBrand: 'VISA',
          cardLast4: '9995',
        };

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const result = await callback(mockPrisma);
          return result;
        });

        mockPrisma.payment.create.mockResolvedValue(mockPayment);

        const dto: CreatePaymentDto = {
          cardNumber: '4000000000009995',
          holderName: 'Test User',
          expiry: futureExpiry,
          cvv: '123',
        };

        const result = await service.processPayment('course-1', dto, mockStudent);

        expect(result.status).toBe('REJECTED');
        expect(result.rejectionReason).toContain('Fondos');
        expect(mockPrisma.enrollment.create).not.toHaveBeenCalled();
      });
    });

    describe('tarjeta de prueba: 4000 0000 0000 0002 (tarjeta rechazada)', () => {
      it('HU26: debe rechazar pago con mensaje de tarjeta rechazada', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
        mockPrisma.enrollment.findFirst.mockResolvedValue(null);
        mockPrisma.payment.findFirst.mockResolvedValue(null);

        const mockPayment = {
          id: 'payment-3',
          status: 'REJECTED',
          rejectionReason: 'Tarjeta rechazada.',
          cardBrand: 'VISA',
          cardLast4: '0002',
        };

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const result = await callback(mockPrisma);
          return result;
        });

        mockPrisma.payment.create.mockResolvedValue(mockPayment);

        const dto: CreatePaymentDto = {
          cardNumber: '4000000000000002',
          holderName: 'Test User',
          expiry: futureExpiry,
          cvv: '123',
        };

        const result = await service.processPayment('course-1', dto, mockStudent);

        expect(result.status).toBe('REJECTED');
        expect(result.rejectionReason).toContain('rechazada');
        expect(mockPrisma.enrollment.create).not.toHaveBeenCalled();
      });
    });

    describe('idempotencia: doble confirmación', () => {
      it('HU26: no debe duplicar pago aprobado si se confirma dos veces', async () => {
        mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
        mockPrisma.enrollment.findFirst.mockResolvedValue(null);

        const existingPayment = {
          id: 'payment-1',
          status: 'APPROVED',
        };

        // Primera llamada: no hay pago aprobado
        mockPrisma.payment.findFirst.mockResolvedValueOnce(null);
        // Segunda llamada: ya existe pago aprobado
        mockPrisma.payment.findFirst.mockResolvedValueOnce(existingPayment);

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          // Simular constraint P2002 (unique violation)
          throw { code: 'P2002' };
        });

        const dto: CreatePaymentDto = {
          cardNumber: '4242424242424242',
          holderName: 'Test User',
          expiry: futureExpiry,
          cvv: '123',
        };

        const result = await service.processPayment('course-1', dto, mockStudent);

        expect(result.status).toBe('APPROVED');
        expect(result.message).toContain('Ya has pagado');
      });
    });
  });

  describe('getPaymentHistory', () => {
    it('HU26: debe devolver historial de pagos del estudiante', async () => {
      const mockPayments = [
        { id: 'payment-1', studentId: 'student-1', courseId: 'course-1', course: { name: 'Course 1' } },
        { id: 'payment-2', studentId: 'student-1', courseId: 'course-2', course: { name: 'Course 2' } },
      ];

      mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await service.getPaymentHistory(mockStudent);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('payment-1');
    });
  });
});
