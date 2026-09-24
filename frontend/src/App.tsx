import { Navigate, Route, Routes } from 'react-router-dom';
import NavBar from './components/NavBar';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import CatalogPage from './pages/CatalogPage';
import CourseDetailPage from './pages/CourseDetailPage';
import MyCoursesPage from './pages/MyCoursesPage';
import ProfessorCoursesPage from './pages/ProfessorCoursesPage';
import CourseEditorPage from './pages/CourseEditorPage';
import AdminInstitutionsPage from './pages/AdminInstitutionsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import EvaluationPage from './pages/EvaluationPage';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin/instituciones" replace />;
  if (user.role === 'PROFESSOR') return <Navigate to="/profesor/cursos" replace />;
  return <Navigate to="/catalogo" replace />;
}

export default function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRedirect />} />

        {/* HU1-HU4: Alumno */}
        <Route
          path="/catalogo"
          element={
            <ProtectedRoute allow={['STUDENT', 'ADMIN']}>
              <CatalogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cursos/:id"
          element={
            <ProtectedRoute>
              <CourseDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-cursos"
          element={
            <ProtectedRoute allow={['STUDENT']}>
              <MyCoursesPage />
            </ProtectedRoute>
          }
        />

        {/* HU12 */}
        <Route
          path="/evaluaciones/:evaluationId"
          element={
            <ProtectedRoute allow={['STUDENT']}>
              <EvaluationPage />
            </ProtectedRoute>
          }
        />

        {/* HU5-HU8, HU11: Profesor */}
        <Route
          path="/profesor/cursos"
          element={
            <ProtectedRoute allow={['PROFESSOR']}>
              <ProfessorCoursesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profesor/cursos/:id"
          element={
            <ProtectedRoute allow={['PROFESSOR']}>
              <CourseEditorPage />
            </ProtectedRoute>
          }
        />

        {/* HU9: Administrador de Sistema */}
        <Route
          path="/admin/instituciones"
          element={
            <ProtectedRoute allow={['ADMIN']}>
              <AdminInstitutionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <ProtectedRoute allow={['ADMIN']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
