import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnalyticsData, getAnalytics } from '../api/analytics';

export default function ProfessorAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      setError(null);
      try {
        const data = await getAnalytics();
        setAnalytics(data);
      } catch (err: any) {
        setError(err.response?.data?.message ?? 'No se pudieron cargar las analíticas.');
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <p className="text-slate-600 dark:text-slate-400">Cargando analíticas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
      </div>
    );
  }

  // HU21 CA8: Si no hay cursos, mostrar mensaje vacío
  if (analytics.length === 0) {
    return (
      <div className="max-w-5xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <h1 className="text-2xl font-semibold mb-8 text-slate-800 dark:text-slate-100">Analíticas de Cursos</h1>
        <div className="text-center py-12">
          <p className="text-slate-600 dark:text-slate-400 mb-4">Sin cursos para analizar</p>
          <Link
            to="/profesor/cursos"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Crear un curso
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <h1 className="text-2xl font-semibold mb-6 text-slate-800 dark:text-slate-100">Analíticas de Cursos</h1>

      <div className="space-y-4">
        {analytics.map((course) => (
          <div
            key={course.courseId}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{course.title}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {course.status === 'published'
                    ? 'Publicado'
                    : course.status === 'unpublished'
                      ? 'Despublicado'
                      : 'Borrador'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Alumnos inscriptos */}
              <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Alumnos inscriptos</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{course.enrolledCount}</p>
              </div>

              {/* Avance promedio */}
              <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Avance promedio</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{course.averageProgress}%</p>
              </div>

              {/* Calificación promedio */}
              <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Calificación promedio</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {course.ratingAverage !== null ? `${course.ratingAverage} ⭐` : 'Sin calificaciones'}
                </p>
              </div>

              {/* Reseñas */}
              <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Reseñas</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{course.ratingCount}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
