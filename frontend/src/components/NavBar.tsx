import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex gap-4 items-center">
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
      <div className="flex gap-3 items-center text-sm">
        <span>{user.name}</span>
        <button onClick={logout} className="underline">
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
