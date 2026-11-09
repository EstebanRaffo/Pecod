import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { SimulatedPaymentProcessor } from './simulated-payment-processor';

describe('SimulatedPaymentProcessor', () => {
  let processor: SimulatedPaymentProcessor;
  let futureExpiry: string;

  beforeEach(() => {
    processor = new SimulatedPaymentProcessor();
    // Calcular fecha de vencimiento futura (MM/YY) para que tests no expiren
    const now = new Date();
    let month = now.getMonth() + 1; // 1-12
    let year = now.getFullYear() + 2; // 2 años adelante
    if (month === 12) {
      month = 1;
      year += 1;
    } else {
      month += 1;
    }
    futureExpiry = `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;
  });

  describe('validación de número de tarjeta', () => {
    it('HU26: debe aceptar tarjeta con espacios', async () => {
      const result = await processor.processPayment(
        '4242 4242 4242 4242',
        'Test User',
        futureExpiry,
        '123',
        new Decimal('100'),
      );

      expect(result.status).toBe('APPROVED');
      expect(result.cardLast4).toBe('4242');
    });

    it('HU26: debe rechazar si no tiene exactamente 16 dígitos (15 dígitos)', async () => {
      await expect(
        processor.processPayment(
          '424242424242424',
          'Test User',
          futureExpiry,
          '123',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HU26: debe rechazar si no tiene exactamente 16 dígitos (17 dígitos)', async () => {
      await expect(
        processor.processPayment(
          '42424242424242424',
          'Test User',
          futureExpiry,
          '123',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HU26: debe rechazar si contiene letras', async () => {
      await expect(
        processor.processPayment(
          '4242424242424A42',
          'Test User',
          futureExpiry,
          '123',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HU26: debe validar algoritmo de Luhn correctamente', async () => {
      // Número válido por formato (16 dígitos) pero inválido por Luhn
      await expect(
        processor.processPayment(
          '4242424242424241', // último dígito es inválido
          'Test User',
          futureExpiry,
          '123',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validación de titular', () => {
    it('HU26: debe rechazar si titular es vacío', async () => {
      await expect(
        processor.processPayment(
          '4242424242424242',
          '',
          futureExpiry,
          '123',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HU26: debe rechazar si titular excede 60 caracteres', async () => {
      const longName = 'A'.repeat(61);
      await expect(
        processor.processPayment(
          '4242424242424242',
          longName,
          futureExpiry,
          '123',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HU26: debe aceptar titular de 60 caracteres', async () => {
      const name60 = 'A'.repeat(60);
      const result = await processor.processPayment(
        '4242424242424242',
        name60,
        futureExpiry,
        '123',
        new Decimal('100'),
      );

      expect(result.status).toBe('APPROVED');
    });
  });

  describe('validación de vencimiento', () => {
    it('HU26: debe rechazar si mes es 00', async () => {
      await expect(
        processor.processPayment(
          '4242424242424242',
          'Test User',
          '00/25',
          '123',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HU26: debe rechazar si mes es 13', async () => {
      await expect(
        processor.processPayment(
          '4242424242424242',
          'Test User',
          '13/25',
          '123',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HU26: debe rechazar si vencimiento es en mes pasado', async () => {
      const now = new Date();
      const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const expiry = `${String(lastMonth).padStart(2, '0')}/${String(lastYear % 100).padStart(2, '0')}`;

      await expect(
        processor.processPayment(
          '4242424242424242',
          'Test User',
          expiry,
          '123',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HU26: debe aceptar vencimiento en mes actual', async () => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const expiry = `${String(currentMonth).padStart(2, '0')}/${String(currentYear % 100).padStart(2, '0')}`;

      const result = await processor.processPayment(
        '4242424242424242',
        'Test User',
        expiry,
        '123',
        new Decimal('100'),
      );

      expect(result.status).toBe('APPROVED');
    });

    it('HU26: debe aceptar vencimiento en mes futuro', async () => {
      const result = await processor.processPayment(
        '4242424242424242',
        'Test User',
        '12/30',
        '123',
        new Decimal('100'),
      );

      expect(result.status).toBe('APPROVED');
    });
  });

  describe('validación de CVV', () => {
    it('HU26: debe rechazar si CVV tiene 2 dígitos', async () => {
      await expect(
        processor.processPayment(
          '4242424242424242',
          'Test User',
          futureExpiry,
          '12',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HU26: debe rechazar si CVV tiene 4 dígitos', async () => {
      await expect(
        processor.processPayment(
          '4242424242424242',
          'Test User',
          futureExpiry,
          '1234',
          new Decimal('100'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HU26: debe aceptar CVV de 3 dígitos', async () => {
      const result = await processor.processPayment(
        '4242424242424242',
        'Test User',
        futureExpiry,
        '123',
        new Decimal('100'),
      );

      expect(result.status).toBe('APPROVED');
    });
  });

  describe('tarjetas de prueba', () => {
    it('HU26: 4242424242424242 debe ser aprobado', async () => {
      const result = await processor.processPayment(
        '4242424242424242',
        'Test User',
        futureExpiry,
        '123',
        new Decimal('100'),
      );

      expect(result.status).toBe('APPROVED');
      expect(result.rejectionReason).toBeUndefined();
      expect(result.cardBrand).toBe('VISA');
      expect(result.cardLast4).toBe('4242');
    });

    it('HU26: 4000000000009995 debe ser rechazado por fondos insuficientes', async () => {
      const result = await processor.processPayment(
        '4000000000009995',
        'Test User',
        futureExpiry,
        '123',
        new Decimal('100'),
      );

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toContain('Fondos');
      expect(result.cardBrand).toBe('VISA');
      expect(result.cardLast4).toBe('9995');
    });

    it('HU26: 4000000000000002 debe ser rechazado por tarjeta rechazada', async () => {
      const result = await processor.processPayment(
        '4000000000000002',
        'Test User',
        futureExpiry,
        '123',
        new Decimal('100'),
      );

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toContain('rechazada');
      expect(result.cardBrand).toBe('VISA');
      expect(result.cardLast4).toBe('0002');
    });
  });

  describe('tarjetas no habilitadas', () => {
    it('HU26: debe rechazar tarjeta válida por Luhn pero no habilitada', async () => {
      // 6011111111111117 es válido por Luhn pero no está en la lista
      await expect(
        processor.processPayment(
          '6011111111111117',
          'Test User',
          futureExpiry,
          '123',
          new Decimal('100'),
        ),
      ).rejects.toThrow('Tarjeta no habilitada');
    });
  });

  describe('no persistencia de datos sensibles', () => {
    it('HU26: no debe devolver número completo de tarjeta', async () => {
      const result = await processor.processPayment(
        '4242424242424242',
        'Test User',
        futureExpiry,
        '123',
        new Decimal('100'),
      );

      expect(result).not.toHaveProperty('cardNumber');
      expect(result.cardLast4).toBe('4242');
    });

    it('HU26: no debe devolver CVV', async () => {
      const result = await processor.processPayment(
        '4242424242424242',
        'Test User',
        futureExpiry,
        '123',
        new Decimal('100'),
      );

      expect(result).not.toHaveProperty('cvv');
    });
  });
});
