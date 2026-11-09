import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es obligatorio.';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El email debe ser válido.';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es obligatoria.';
    } else if (formData.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    }

    if (!formData.passwordConfirm) {
      newErrors.passwordConfirm = 'La confirmación de contraseña es obligatoria.';
    } else if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = 'Las contraseñas no coinciden.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        passwordConfirm: formData.passwordConfirm,
      });

      setSuccessMessage(
        'Registro exitoso. Por favor, verifica tu email para completar el proceso.',
      );
      setFormData({ name: '', email: '', password: '', passwordConfirm: '' });

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Ocurrió un error al registrarse. Intenta de nuevo.';
      setErrors({ submit: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-lg shadow"
      >
        <h1 className="text-2xl font-semibold mb-6 text-slate-800 dark:text-slate-100">
          Registrarse en PECOD
        </h1>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
            {successMessage}
          </div>
        )}

        {errors.submit && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
            {errors.submit}
          </div>
        )}

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Nombre
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={`w-full mb-4 rounded border ${
            errors.name
              ? 'border-red-500'
              : 'border-slate-300 dark:border-slate-500'
          } dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 px-3 py-2`}
          placeholder="Tu nombre completo"
        />
        {errors.name && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{errors.name}</p>
        )}

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Email
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className={`w-full mb-4 rounded border ${
            errors.email
              ? 'border-red-500'
              : 'border-slate-300 dark:border-slate-500'
          } dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 px-3 py-2`}
          placeholder="tu.email@institucion.edu.ar"
        />
        {errors.email && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{errors.email}</p>
        )}

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Contraseña
        </label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className={`w-full mb-4 rounded border ${
            errors.password
              ? 'border-red-500'
              : 'border-slate-300 dark:border-slate-500'
          } dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 px-3 py-2`}
          placeholder="Al menos 8 caracteres"
        />
        {errors.password && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{errors.password}</p>
        )}

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Confirmar Contraseña
        </label>
        <input
          type="password"
          value={formData.passwordConfirm}
          onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
          className={`w-full mb-4 rounded border ${
            errors.passwordConfirm
              ? 'border-red-500'
              : 'border-slate-300 dark:border-slate-500'
          } dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 px-3 py-2`}
          placeholder="Confirma tu contraseña"
        />
        {errors.passwordConfirm && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            {errors.passwordConfirm}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-800 dark:bg-slate-700 text-white py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          {loading ? 'Registrando...' : 'Registrarse'}
        </button>

        <div className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            className="text-slate-800 dark:text-slate-200 hover:underline font-medium"
          >
            Inicia sesión aquí
          </Link>
        </div>
      </form>
    </div>
  );
}
