import { Injectable, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { IPaymentProcessor, PaymentResult } from './interfaces/payment-processor.interface';

// HU26: Constantes de tarjetas de prueba
const TEST_CARDS = {
  APPROVED: '4242424242424242',
  INSUFFICIENT_FUNDS: '4000000000009995',
  REJECTED: '4000000000000002',
} as const;

// HU26: Validador de algoritmo de Luhn
function validateLuhn(cardNumber: string): boolean {
  let sum = 0;
  let isEven = false;

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// HU26: Detectar marca de tarjeta (básico)
function detectCardBrand(cardNumber: string): string {
  if (cardNumber.startsWith('4')) return 'VISA';
  if (cardNumber.startsWith('5')) return 'MASTERCARD';
  if (cardNumber.startsWith('3')) return 'AMEX';
  return 'UNKNOWN';
}

@Injectable()
export class SimulatedPaymentProcessor implements IPaymentProcessor {
  async processPayment(
    cardNumber: string,
    holderName: string,
    expiry: string,
    cvv: string,
    amount: Decimal,
  ): Promise<PaymentResult> {
    // HU26: Normalizar número de tarjeta (eliminar espacios)
    const normalizedCard = cardNumber.replace(/\s+/g, '');

    // Validación: exactamente 16 dígitos
    if (!/^\d{16}$/.test(normalizedCard)) {
      throw new BadRequestException('El número de tarjeta debe tener exactamente 16 dígitos.');
    }

    // Validación: algoritmo de Luhn
    if (!validateLuhn(normalizedCard)) {
      throw new BadRequestException('El número de tarjeta no es válido (fallo en validación de dígito verificador).');
    }

    // Validación: titular no vacío
    if (!holderName || holderName.trim().length === 0) {
      throw new BadRequestException('El nombre del titular es obligatorio.');
    }

    // Validación: titular máximo 60 caracteres
    if (holderName.length > 60) {
      throw new BadRequestException('El nombre del titular no puede exceder 60 caracteres.');
    }

    // Validación: vencimiento MM/AA
    const expiryMatch = expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!expiryMatch) {
      throw new BadRequestException('El vencimiento debe tener formato MM/AA.');
    }

    const [, monthStr, yearStr] = expiryMatch;
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (month < 1 || month > 12) {
      throw new BadRequestException('El mes de vencimiento debe estar entre 01 y 12.');
    }

    // Validación: mes igual o posterior al mes actual
    const now = new Date();
    const currentYear = now.getFullYear() % 100; // últimos 2 dígitos
    const currentMonth = now.getMonth() + 1; // 1-12

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      throw new BadRequestException('La tarjeta ha expirado.');
    }

    // Validación: CVV exactamente 3 dígitos
    if (!/^\d{3}$/.test(cvv)) {
      throw new BadRequestException('El CVV debe tener exactamente 3 dígitos.');
    }

    // HU26: Verificar que sea una tarjeta de prueba habilitada
    const testCardsArray = Object.values(TEST_CARDS) as string[];
    if (!testCardsArray.includes(normalizedCard)) {
      throw new BadRequestException('Tarjeta no habilitada en el entorno de pruebas.');
    }

    // HU26: Obtener marca y últimos 4 dígitos (nunca guardar número completo ni CVV)
    const cardBrand = detectCardBrand(normalizedCard);
    const cardLast4 = normalizedCard.slice(-4);

    // HU26: Procesar pago según tarjeta
    if (normalizedCard === TEST_CARDS.APPROVED) {
      return {
        status: 'APPROVED',
        cardBrand,
        cardLast4,
      };
    }

    if (normalizedCard === TEST_CARDS.INSUFFICIENT_FUNDS) {
      return {
        status: 'REJECTED',
        rejectionReason: 'Fondos insuficientes.',
        cardBrand,
        cardLast4,
      };
    }

    if (normalizedCard === TEST_CARDS.REJECTED) {
      return {
        status: 'REJECTED',
        rejectionReason: 'Tarjeta rechazada.',
        cardBrand,
        cardLast4,
      };
    }

    // Fallback (no debería alcanzarse porque se valida arriba)
    throw new BadRequestException('No se pudo procesar el pago.');
  }
}
