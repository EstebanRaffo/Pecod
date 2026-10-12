import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Topic {
  id: string;
  title: string;
  order: number;
}

interface CourseDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  technology: string | null;
  academicRequirements: string | null;
  skills: string | null;
  isEnrolled: boolean;
  topics: Topic[];
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    api.get<CourseDetail>(`/courses/${id}`).then(({ data }) => {
      setCourse(data);
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
      <div className="flex flex-wrap items-center gap-x-2 text-xs uppercase text-slate-500 mb-1">
        <span>{course.category}</span>
        {course.technology && <><span>·</span><span>{course.technology}</span></>}
      </div>
      <h1 className="text-3xl font-semibold mb-2">{course.name}</h1>
      <p className="text-slate-700 mb-4">{course.description}</p>

      {course.academicRequirements && (
        <p className="mb-2 whitespace-pre-wrap">
          <strong>Requerimientos Académicos:</strong> {course.academicRequirements}
        </p>
      )}
      {course.skills && (
        <p className="mb-4 whitespace-pre-wrap">
          <strong>Aptitudes adquiridas al finalizar el curso:</strong> {course.skills}
        </p>
      )}

      <h2 className="font-semibold text-lg mb-2">Temario</h2>
      <ul className="list-disc list-inside mb-6 text-slate-700">
        {course.topics.map((topic) => (
          <li key={topic.id}>{topic.title}</li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {user?.role === 'STUDENT' &&
        (course.isEnrolled ? (
          <button
            onClick={() => navigate(`/mis-cursos/${course.id}`)}
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
