import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No se proporcionó un token de verificación válido.');
      return;
    }

    async function verifyEmail() {
      try {
        const response = await api.post('/auth/verify-email', { token });
        setStatus('success');
        setMessage(response.data.message || 'Email verificado correctamente.');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } catch (error: any) {
        setStatus('error');
        setMessage(
          error.response?.data?.message ||
            error.message ||
            'Ocurrió un error al verificar tu email.',
        );
      }
    }

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-lg shadow text-center">
        <h1 className="text-2xl font-semibold mb-6 text-slate-800 dark:text-slate-100">
          Verificar Email
        </h1>

        {status === 'loading' && (
          <div>
            <div className="inline-block animate-spin">
              <svg
                className="w-8 h-8 text-slate-600 dark:text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Verificando tu email...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="text-green-600 dark:text-green-400 text-5xl mb-4">✓</div>
            <p className="text-green-600 dark:text-green-400 mb-6">{message}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Redirigiendo a login...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="text-red-600 dark:text-red-400 text-5xl mb-4">✗</div>
            <p className="text-red-600 dark:text-red-400 mb-6">{message}</p>
            <Link
              to="/register"
              className="inline-block bg-slate-800 dark:bg-slate-700 text-white py-2 px-4 rounded hover:bg-slate-700 dark:hover:bg-slate-600"
            >
              Volver al Registro
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
