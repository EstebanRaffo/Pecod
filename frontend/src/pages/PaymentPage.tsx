import { FormEvent, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  validateCardNumber,
  validateHolderName,
  validateExpiry,
  validateCVV,
  formatCardNumber,
  getCardBrand,
} from '../utils/validation';

interface CourseBasic {
  id: string;
  name: string;
  price: number | null;
}

interface PaymentResponse {
  id: string;
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<CourseBasic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Estados de procesamiento
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResponse | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<CourseBasic>(`/courses/${id}`)
      .then(({ data }) => {
        setCourse(data);
        if (!data.price || data.price <= 0) {
          setError('Este curso es gratuito.');
        }
      })
      .catch(() => {
        setError('No se pudo cargar el curso.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  function handleCardNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
  }

  function handleExpiryChange(e: React.ChangeEvent<HTMLInputElement>) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    setExpiry(value);
  }

  function handleCvvChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCvv(e.target.value.replace(/\D/g, '').slice(0, 3));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormErrors([]);
    setPaymentResult(null);

    // Validar
    const errors: string[] = [];

    const cardError = validateCardNumber(cardNumber);
    if (cardError) errors.push(cardError);

    const nameError = validateHolderName(holderName);
    if (nameError) errors.push(nameError);

    const expiryError = validateExpiry(expiry);
    if (expiryError) errors.push(expiryError);

    const cvvError = validateCVV(cvv);
    if (cvvError) errors.push(cvvError);

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    // Procesar pago
    setProcessing(true);
    try {
      const { data } = await api.post<PaymentResponse>(`/courses/${id}/payments`, {
        cardNumber: cardNumber.replace(/\s/g, ''),
        holderName,
        expiry,
        cvv,
      });

      setPaymentResult(data);

      if (data.status === 'APPROVED') {
        // Redirigir a mis cursos después de 2 segundos
        setTimeout(() => {
          navigate('/mis-cursos');
        }, 2000);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message ?? 'Error al procesar el pago.';
      setFormErrors([errorMessage]);
    } finally {
      setProcessing(false);
    }
  }

  function handleRetry() {
    setPaymentResult(null);
    setCardNumber('');
    setHolderName('');
    setExpiry('');
    setCvv('');
    setFormErrors([]);
  }

  if (loading) {
    return <p className="p-6 text-slate-700 dark:text-slate-300">Cargando...</p>;
  }

  if (error && !course) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <p className="text-slate-700 dark:text-slate-300">Curso no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Pagar por el curso</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">{course.name}</p>
        <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-2">${course.price?.toFixed(2)} ARS</p>
      </div>

      {/* Mostrar resultado si el pago fue aprobado o rechazado */}
      {paymentResult && (
        <div className={`mb-6 p-4 rounded-lg ${paymentResult.status === 'APPROVED' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
          <p className={`font-semibold ${paymentResult.status === 'APPROVED' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {paymentResult.status === 'APPROVED' ? '✅ Pago aprobado' : '❌ Pago rechazado'}
          </p>
          {paymentResult.rejectionReason && (
            <p className={`text-sm mt-1 ${paymentResult.status === 'APPROVED' ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
              {paymentResult.rejectionReason}
            </p>
          )}
          {paymentResult.status === 'APPROVED' && (
            <p className="text-sm text-green-600 dark:text-green-300 mt-2">Redirigiendo a &quot;Mis cursos&quot;...</p>
          )}
          {paymentResult.status === 'REJECTED' && (
            <button
              onClick={handleRetry}
              className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {/* Aviso */}
      <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="font-semibold text-amber-800 dark:text-amber-200">⚠️ Entorno de pruebas</p>
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
          No ingreses datos reales de tarjetas de crédito. Usa solo las tarjetas de prueba que se muestran abajo.
        </p>
      </div>

      {/* Tabla de tarjetas de prueba */}
      <div className="mb-6 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
        <p className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Tarjetas de prueba disponibles:</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-start p-2 bg-slate-50 dark:bg-slate-700 rounded">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">4242 4242 4242 4242</p>
              <p className="text-slate-600 dark:text-slate-400">Vencimiento: cualquiera | CVV: cualquiera</p>
            </div>
            <p className="font-semibold text-green-600 dark:text-green-400">✅ Aprobado</p>
          </div>
          <div className="flex justify-between items-start p-2 bg-slate-50 dark:bg-slate-700 rounded">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">4000 0000 0000 9995</p>
              <p className="text-slate-600 dark:text-slate-400">Vencimiento: cualquiera | CVV: cualquiera</p>
            </div>
            <p className="font-semibold text-red-600 dark:text-red-400">❌ Fondos insuficientes</p>
          </div>
          <div className="flex justify-between items-start p-2 bg-slate-50 dark:bg-slate-700 rounded">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">4000 0000 0000 0002</p>
              <p className="text-slate-600 dark:text-slate-400">Vencimiento: cualquiera | CVV: cualquiera</p>
            </div>
            <p className="font-semibold text-red-600 dark:text-red-400">❌ Tarjeta rechazada</p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      {!paymentResult || paymentResult.status === 'REJECTED' ? (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
          {/* Errores */}
          {formErrors.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Errores en el formulario:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {formErrors.map((err, idx) => (
                  <li key={idx} className="text-red-600 dark:text-red-300 text-sm">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Número de tarjeta */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Número de Tarjeta
            </label>
            <input
              type="text"
              placeholder="XXXX XXXX XXXX XXXX"
              value={cardNumber}
              onChange={handleCardNumberChange}
              maxLength={19}
              disabled={processing}
              className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2 font-mono"
            />
            {cardNumber && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Marca: <span className="font-medium">{getCardBrand(cardNumber)}</span>
              </p>
            )}
          </div>

          {/* Nombre del titular */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nombre del Titular
            </label>
            <input
              type="text"
              placeholder="Nombre Apellido"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value.slice(0, 60))}
              disabled={processing}
              className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {holderName.length}/60
            </p>
          </div>

          {/* Vencimiento y CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Vencimiento
              </label>
              <input
                type="text"
                placeholder="MM/AA"
                value={expiry}
                onChange={handleExpiryChange}
                maxLength={5}
                disabled={processing}
                className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                CVV
              </label>
              <input
                type="password"
                placeholder="●●●"
                value={cvv}
                onChange={handleCvvChange}
                maxLength={3}
                disabled={processing}
                className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2 font-mono"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={processing}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-semibold"
            >
              {processing ? 'Procesando...' : 'Pagar'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/cursos/${id}`)}
              disabled={processing}
              className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
