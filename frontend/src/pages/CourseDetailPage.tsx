import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Topic {
  id: string;
  title: string;
  order: number;
}

interface Evaluation {
  id: string;
  title: string;
  minScore: number;
}

interface CourseDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  skills: string | null;
  tools: string | null;
  isEnrolled: boolean;
  topics: Topic[];
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    api.get<CourseDetail>(`/courses/${id}`).then(({ data }) => {
      setCourse(data);
      if (data.isEnrolled) {
        api.get<Evaluation[]>(`/courses/${id}/evaluations`).then((res) => setEvaluations(res.data));
      }
    });
  }, [id]);

  async function handleEnroll() {
    setEnrolling(true);
    setError(null);
    try {
      await api.post(`/courses/${id}/enroll`);
      navigate('/mis-cursos');
    } catch (err: any) {
      // HU2: doble inscripción / curso despublicado / fuera de institución
      setError(err.response?.data?.message ?? 'No se pudo completar la inscripción.');
    } finally {
      setEnrolling(false);
    }
  }

  if (!course) return <p className="p-6">Cargando...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <span className="text-xs uppercase text-slate-500">{course.category}</span>
      <h1 className="text-3xl font-semibold mb-2">{course.name}</h1>
      <p className="text-slate-700 mb-4">{course.description}</p>

      {course.tools && (
        <p className="mb-1">
          <strong>Herramientas necesarias:</strong> {course.tools}
        </p>
      )}
      {course.skills && (
        <p className="mb-4">
          <strong>Aptitudes a adquirir:</strong> {course.skills}
        </p>
      )}

      <h2 className="font-semibold text-lg mb-2">Temario</h2>
      <ul className="list-disc list-inside mb-6 text-slate-700">
        {course.topics.map((topic) => (
          <li key={topic.id}>{topic.title}</li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {course.isEnrolled && evaluations.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-lg mb-2">Evaluaciones</h2>
          <ul className="space-y-1">
            {evaluations.map((ev) => (
              <li key={ev.id}>
                <Link to={`/evaluaciones/${ev.id}`} className="text-slate-800 underline">
                  {ev.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {user?.role === 'STUDENT' &&
        (course.isEnrolled ? (
          <button
            onClick={() => navigate('/mis-cursos')}
            className="bg-slate-800 text-white px-4 py-2 rounded"
          >
            Ir al contenido
          </button>
        ) : (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="bg-slate-800 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {enrolling ? 'Inscribiendo...' : 'Inscribirme'}
          </button>
        ))}
    </div>
  );
}
