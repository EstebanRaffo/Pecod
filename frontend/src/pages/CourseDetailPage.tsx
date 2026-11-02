import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getCourseProgress } from '../api/progress';
import { CourseReviewSection } from '../components/CourseReviewSection';

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
  const [canReview, setCanReview] = useState(false);
  const [reviewReason, setReviewReason] = useState('');

  useEffect(() => {
    let active = true;

    async function loadCourse() {
      try {
        const { data } = await api.get<CourseDetail>(`/courses/${id}`);
        if (!active) return;
        setCourse(data);

        if (user?.role === 'STUDENT' && data.isEnrolled) {
          const progress = await getCourseProgress(data.id);
          if (!active) return;
          const eligible = progress.percentage >= 50;
          setCanReview(eligible);
          setReviewReason(
            eligible
              ? ''
              : `Necesitás tener al menos 50% de avance o finalizar el curso. Actualmente tenés ${progress.percentage}%.`,
          );
        } else {
          setCanReview(false);
          setReviewReason('Solo los alumnos inscriptos pueden calificar este curso.');
        }
      } catch {
        if (active) {
          setError('No se pudo cargar el curso.');
          setReviewReason('No se pudo verificar tu avance. Volvé a intentarlo más tarde.');
        }
      }
    }

    loadCourse();
    return () => {
      active = false;
    };
  }, [id, user?.role]);

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

  if (!course) return <p className="p-6 text-slate-700 dark:text-slate-300">Cargando...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="flex flex-wrap items-center gap-x-2 text-xs uppercase text-slate-500 dark:text-slate-400 mb-1">
        <span>{course.category}</span>
        {course.technology && <><span>·</span><span>{course.technology}</span></>}
      </div>
      <h1 className="text-3xl font-semibold mb-2 text-slate-800 dark:text-slate-100">{course.name}</h1>
      <p className="text-slate-700 dark:text-slate-300 mb-4">{course.description}</p>

      {course.academicRequirements && (
        <p className="mb-2 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
          <strong>Requerimientos Académicos:</strong> {course.academicRequirements}
        </p>
      )}
      {course.skills && (
        <p className="mb-4 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
          <strong>Aptitudes adquiridas al finalizar el curso:</strong> {course.skills}
        </p>
      )}

      <h2 className="font-semibold text-lg mb-2 text-slate-800 dark:text-slate-100">Temario</h2>
      <ul className="list-disc list-inside mb-6 text-slate-700 dark:text-slate-300">
        {course.topics.map((topic) => (
          <li key={topic.id}>{topic.title}</li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {user?.role === 'STUDENT' &&
        (course.isEnrolled ? (
          <button
            onClick={() => navigate(`/mis-cursos/${course.id}`)}
            className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600"
          >
            Ir al contenido
          </button>
        ) : (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {enrolling ? 'Inscribiendo...' : 'Inscribirme'}
          </button>
        ))}

      <CourseReviewSection
        courseId={course.id}
        isEnrolled={user?.role === 'STUDENT' && course.isEnrolled}
        canReview={canReview}
        reviewReason={reviewReason}
      />
    </div>
  );
}
