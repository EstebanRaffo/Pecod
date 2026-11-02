import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';

export default function NavBar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  if (!user) return null;

  return (
    <nav className="relative bg-slate-800 dark:bg-slate-900 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-4 items-center">
        <span className="font-semibold">PECOD</span>
        {user.role === 'STUDENT' && (
          <>
            <Link to="/catalogo">Catálogo</Link>
            <Link to="/mis-cursos">Mis cursos</Link>
          </>
        )}
        {user.role === 'PROFESSOR' && (
          <>
            <Link to="/profesor/cursos">Mis cursos</Link>
            <Link to="/profesor/analiticas">Analíticas</Link>
          </>
        )}
        {user.role === 'ADMIN' && (
          <>
            <Link to="/admin/instituciones">Instituciones</Link>
            <Link to="/admin/usuarios">Usuarios</Link>
          </>
        )}
      </div>
      <div className="flex gap-3 items-center text-sm min-w-0 max-w-full ml-auto">
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          className="p-1 rounded hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <span className="break-words min-w-0">{user.name}</span>
        {user.role === 'STUDENT' && <NotificationBell key={user.id} />}
        <button onClick={logout} className="underline shrink-0">
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
