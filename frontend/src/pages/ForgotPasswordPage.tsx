import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      // HU22: Solicitar token de reset
      const response = await api.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
      setSubmitted(true);
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-lg shadow">
        <h1 className="text-2xl font-semibold mb-2 text-slate-800 dark:text-slate-100">Recuperar Contraseña</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Ingresa tu email para recibir instrucciones de restablecimiento.
        </p>

        {submitted ? (
          <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded p-4 mb-4">
            <p className="text-green-800 dark:text-green-100 text-sm">{message}</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
              Por favor, revisa tu email (incluyendo la carpeta de spam).
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className={submitted ? 'hidden' : ''}>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full mb-4 rounded border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 px-3 py-2"
          />

          {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 dark:bg-slate-700 text-white py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar Instrucciones'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
            Volver al login
          </Link>
        </div>

        {submitted && (
          <button
            onClick={() => {
              setSubmitted(false);
              setMessage(null);
            }}
            className="w-full mt-4 bg-slate-600 dark:bg-slate-600 text-white py-2 rounded hover:bg-slate-500 dark:hover:bg-slate-500"
          >
            Enviar Otro Email
          </button>
        )}
      </div>
    </div>
  );
}
