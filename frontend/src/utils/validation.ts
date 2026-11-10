/**
 * Validadores para HU-25: Monetización de cursos (Pago simulado)
 */

/**
 * Algoritmo de Luhn para validar números de tarjeta
 * @param cardNumber - Número de tarjeta sin espacios
 * @returns true si el número pasa la validación de Luhn
 */
export function luhnCheck(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false;

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

/**
 * Valida el número de tarjeta
 * @param cardNumber - Número de tarjeta (puede contener espacios)
 * @returns Mensaje de error o null si es válido
 */
export function validateCardNumber(cardNumber: string): string | null {
  const normalized = cardNumber.replace(/\s/g, '');

  if (!normalized) return 'El número de tarjeta es obligatorio.';
  if (!/^\d+$/.test(normalized)) return 'El número debe contener solo dígitos.';
  if (normalized.length !== 16) return 'El número debe tener exactamente 16 dígitos.';
  if (!luhnCheck(normalized)) return 'El número de tarjeta no es válido (falló validación de Luhn).';

  return null;
}

/**
 * Valida el nombre del titular de la tarjeta
 * @param holderName - Nombre del titular
 * @returns Mensaje de error o null si es válido
 */
export function validateHolderName(holderName: string): string | null {
  if (!holderName || !holderName.trim()) return 'El nombre del titular es obligatorio.';
  if (holderName.length > 60) return 'El nombre no debe exceder 60 caracteres.';

  return null;
}

/**
 * Valida la fecha de vencimiento
 * @param expiry - Fecha en formato MM/AA
 * @returns Mensaje de error o null si es válido
 */
export function validateExpiry(expiry: string): string | null {
  if (!expiry) return 'El vencimiento es obligatorio.';
  if (!/^\d{2}\/\d{2}$/.test(expiry)) return 'El formato debe ser MM/AA.';

  const [month, year] = expiry.split('/');
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (monthNum < 1 || monthNum > 12) return 'El mes debe estar entre 01 y 12.';

  // Validar que no esté vencido
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear() % 100;

  if (yearNum < currentYear) return 'La tarjeta está vencida.';
  if (yearNum === currentYear && monthNum < currentMonth) return 'La tarjeta está vencida.';

  return null;
}

/**
 * Valida el código de seguridad (CVV)
 * @param cvv - Código de seguridad
 * @returns Mensaje de error o null si es válido
 */
export function validateCVV(cvv: string): string | null {
  if (!cvv) return 'El CVV es obligatorio.';
  if (!/^\d{3}$/.test(cvv)) return 'El CVV debe tener exactamente 3 dígitos.';

  return null;
}

/**
 * Valida todos los campos del formulario de pago
 * @param cardNumber - Número de tarjeta
 * @param holderName - Nombre del titular
 * @param expiry - Fecha de vencimiento (MM/AA)
 * @param cvv - Código de seguridad
 * @returns Array de errores (vacío si todo es válido)
 */
export function validatePaymentForm(
  cardNumber: string,
  holderName: string,
  expiry: string,
  cvv: string,
): string[] {
  const errors: string[] = [];

  const cardError = validateCardNumber(cardNumber);
  if (cardError) errors.push(cardError);

  const nameError = validateHolderName(holderName);
  if (nameError) errors.push(nameError);

  const expiryError = validateExpiry(expiry);
  if (expiryError) errors.push(expiryError);

  const cvvError = validateCVV(cvv);
  if (cvvError) errors.push(cvvError);

  return errors;
}

/**
 * Formatea un número de tarjeta agregando espacios cada 4 dígitos
 * @param cardNumber - Número sin formato
 * @returns Número formateado con espacios
 */
export function formatCardNumber(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\s/g, '').slice(0, 16);
  const groups = cleaned.match(/.{1,4}/g) || [];
  return groups.join(' ');
}

/**
 * Obtiene la marca de la tarjeta según el número
 * @param cardNumber - Número de tarjeta sin espacios
 * @returns Marca de la tarjeta ('VISA', 'MASTERCARD', 'UNKNOWN')
 */
export function getCardBrand(cardNumber: string): string {
  const normalized = cardNumber.replace(/\s/g, '');

  if (/^4/.test(normalized)) return 'VISA';
  if (/^5[1-5]/.test(normalized)) return 'MASTERCARD';

  return 'UNKNOWN';
}
