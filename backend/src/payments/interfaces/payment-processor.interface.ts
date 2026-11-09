import { Decimal } from '@prisma/client/runtime/library';

// HU26: Resultado de procesamiento de pago
export type PaymentResult = {
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string; // presente si status = REJECTED
  cardBrand: string;
  cardLast4: string;
};

// HU26: Interfaz de procesador de pagos (permite futuras integraciones con pasarelas reales)
export interface IPaymentProcessor {
  processPayment(
    cardNumber: string,
    holderName: string,
    expiry: string,
    cvv: string,
    amount: Decimal,
  ): Promise<PaymentResult>;
}
