import { FormEvent, useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No se proporcionó token de restablecimiento. Solicita uno nuevo.');
    }
  }, [token]);

  function validateForm(): string | null {
    // HU22: Validaciones de contraseña
    if (password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (password !== confirmPassword) {
      return 'Las contraseñas no coinciden.';
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      // HU22: Restablecer contraseña
      await api.post('/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');

      // Redirigir al login después de 3 segundos con mensaje de éxito
      setTimeout(() => {
        navigate('/login', { state: { message: 'Contraseña restablecida exitosamente. Por favor, inicia sesión.' } });
      }, 3000);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Error al restablecer la contraseña.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-lg shadow">
        <h1 className="text-2xl font-semibold mb-2 text-slate-800 dark:text-slate-100">Establecer Nueva Contraseña</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta.
        </p>

        {success && (
          <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded p-4 mb-4">
            <p className="text-green-800 dark:text-green-100 text-sm">
              ¡Contraseña restablecida exitosamente! Serás redirigido al login en unos segundos...
            </p>
          </div>
        )}

        {!token || error === 'No se proporcionó token de restablecimiento. Solicita uno nuevo.' ? (
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded p-4">
            <p className="text-red-800 dark:text-red-100 text-sm mb-4">{error}</p>
            <Link
              to="/forgot-password"
              className="inline-block w-full text-center bg-slate-800 dark:bg-slate-700 text-white py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600"
            >
              Solicitar Nuevo Enlace
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Nueva Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full mb-4 rounded border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 px-3 py-2"
            />

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Confirmar Contraseña
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contraseña"
              className="w-full mb-4 rounded border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 px-3 py-2"
            />

            {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading || success}
              className="w-full bg-slate-800 dark:bg-slate-700 text-white py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              {loading ? 'Restableciendo...' : 'Restablecer Contraseña'}
            </button>

            <div className="mt-4 text-center text-sm">
              <Link to="/login" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
                Volver al login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
