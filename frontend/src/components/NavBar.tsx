import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="relative bg-slate-800 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-4 items-center">
        <span className="font-semibold">PECOD</span>
        {user.role === 'STUDENT' && (
          <>
            <Link to="/catalogo">Catálogo</Link>
            <Link to="/mis-cursos">Mis cursos</Link>
          </>
        )}
        {user.role === 'PROFESSOR' && <Link to="/profesor/cursos">Mis cursos</Link>}
        {user.role === 'ADMIN' && (
          <>
            <Link to="/admin/instituciones">Instituciones</Link>
            <Link to="/admin/usuarios">Usuarios</Link>
          </>
        )}
      </div>
      <div className="flex gap-3 items-center text-sm min-w-0 max-w-full ml-auto">
        <span className="break-words min-w-0">{user.name}</span>
        {user.role === 'STUDENT' && <NotificationBell key={user.id} />}
        <button onClick={logout} className="underline shrink-0">
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
