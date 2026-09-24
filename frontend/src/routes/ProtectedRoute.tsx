import { Navigate } from 'react-router-dom';
import { useAuth, Role } from '../context/AuthContext';

interface Props {
  children: JSX.Element;
  allow?: Role[]; // si se omite, alcanza con estar autenticado
}

// HU10: "un usuario no puede acceder a funcionalidades o vistas reservadas a otro rol"
export function ProtectedRoute({ children, allow }: Props) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
