import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      // HU10: redirección según rol
      if (user.role === 'ADMIN') navigate('/admin/instituciones');
      else if (user.role === 'PROFESSOR') navigate('/profesor/cursos');
      else navigate('/catalogo');
    } catch {
      // HU10: mensaje genérico, sin revelar si el usuario existe
      setError('Email o contraseña incorrectos.');
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

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

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
      </form>
    </div>
  );
}
