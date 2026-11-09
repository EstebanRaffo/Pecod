import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// HU23: Actualizado para manejar verificación de email
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setShowResendOption(false);
    setLoading(true);
    try {
      const user = await login(email, password);
      // HU10: redirección según rol
      if (user.role === 'ADMIN') navigate('/admin/instituciones');
      else if (user.role === 'PROFESSOR') navigate('/profesor/cursos');
      else navigate('/catalogo');
    } catch (err: any) {
      // HU23: Si es error 403, usuario no verificó email
      if (err.response?.status === 403) {
        setError(err.response?.data?.message || 'Tu email aún no ha sido verificado.');
        setShowResendOption(true);
      } else {
        // HU10: mensaje genérico, sin revelar si el usuario existe
        setError('Email o contraseña incorrectos.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!email) {
      setError('Por favor, ingresa tu email.');
      return;
    }
    setLoading(true);
    try {
      const { api } = await import('../api/client');
      await api.post('/auth/resend-verification', { email });
      setError(
        'Si el email existe, recibirás un enlace de verificación en tu bandeja de entrada.',
      );
      setShowResendOption(false);
    } catch {
      setError('Ocurrió un error. Intenta más tarde.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-lg shadow">
        <h1 className="text-2xl font-semibold mb-6 text-slate-800 dark:text-slate-100">Ingresar a PECOD</h1>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 rounded border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 px-3 py-2"
        />

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 rounded border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 px-3 py-2"
        />

        {error && (
          <div className={`text-sm mb-4 p-3 rounded ${
            showResendOption ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}>
            {error}
          </div>
        )}

        {showResendOption && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full mb-2 bg-blue-600 dark:bg-blue-700 text-white py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Reenviando...' : 'Reenviar enlace de verificación'}
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-800 dark:bg-slate-700 text-white py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>

        {/* HU22: Enlace para recuperar contraseña */}
        <div className="mt-4 text-center">
          <Link to="/forgot-password" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {/* HU23: Enlace para registro */}
        <div className="mt-3 text-center">
          <Link to="/register" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
            ¿No tienes cuenta? Registrate aquí
          </Link>
        </div>
      </form>
    </div>
  );
}
