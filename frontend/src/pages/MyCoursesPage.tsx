import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { CourseProgress } from '../api/progress';
import CourseProgressBar from '../components/CourseProgressBar';

interface EnrollmentItem {
  id: string;
  progress: CourseProgress;
  course: {
    id: string;
    name: string;
    category: string;
    isPublished: boolean;
  };
}

export default function MyCoursesPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<EnrollmentItem[]>('/enrollments/my-courses')
      .then(({ data }) => setEnrollments(data))
      .catch((err) => setError(err.response?.data?.message ?? 'No se pudieron cargar tus cursos.'));
  }, []);

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!enrollments) return <p className="p-6">Cargando...</p>;

  // HU3: mensaje claro cuando no hay inscripciones, con acceso directo al catálogo
  if (enrollments.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <p className="text-slate-600 mb-4">Sin cursos en progreso.</p>
        <Link to="/catalogo" className="text-slate-800 underline">
          Ir al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Mis cursos</h1>
      <div className="space-y-3">
        {enrollments.map(({ id, course, progress }) => (
          <Link
            key={id}
            to={`/mis-cursos/${course.id}`}
            className="block border rounded-lg p-4 hover:shadow-md transition"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="min-w-0 break-words">
                <span className="text-xs uppercase text-slate-500">{course.category}</span>
                <h2 className="font-semibold">{course.name}</h2>
              </div>
              {/* HU3: curso despublicado luego de la inscripción se identifica como no disponible */}
              {!course.isPublished && (
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">
                  No disponible
                </span>
              )}
            </div>
            <CourseProgressBar progress={progress} />
          </Link>
        ))}
      </div>
    </div>
  );
}
