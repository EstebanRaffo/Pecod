import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { CourseProgress, getCourseProgress, setTopicViewed } from '../api/progress';
import CourseProgressBar from '../components/CourseProgressBar';

interface Material {
  id: string;
  fileName: string;
  fileUrl: string | null;
  fileType: string;
}

interface Topic {
  id: string;
  title: string;
  order: number;
  videoUrl: string | null;
  screenRecordingUrl: string | null;
  contentText: string | null;
  materials: Material[];
}

interface CourseDetail {
  id: string;
  name: string;
  category: string;
  technology: string | null;
  isEnrolled: boolean;
  topics: Topic[];
}

interface Evaluation {
  id: string;
  title: string;
  minScore: number;
  topicId: string | null;
}

function ReadingMaterial({ text }: { text: string }) {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const rawUrl = match[0];
    const url = rawUrl.replace(/[.,;:!?)]+$/, '');
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline break-all">
        {url}
      </a>,
    );
    if (rawUrl.length > url.length) parts.push(rawUrl.slice(url.length));
    lastIndex = match.index + rawUrl.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

export default function CourseLearningPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [savingTopicId, setSavingTopicId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setCourse(null);
    setProgress(null);
    setEvaluations([]);
    setError(null);

    async function loadCourseContent() {
      try {
        const { data: courseData } = await api.get<CourseDetail>(`/courses/${id}`);
        if (!active) return;
        setCourse(courseData);

        if (courseData.isEnrolled) {
          await Promise.all([
            getCourseProgress(courseData.id).then((data) => {
              if (active) setProgress(data);
            }).catch((err) => {
              if (active) setError(err.response?.data?.message ?? 'No se pudo cargar el avance del curso.');
            }),
            api.get<Evaluation[]>(`/courses/${id}/evaluations`).then(({ data }) => {
              if (active) setEvaluations(data);
            }).catch((err) => {
              if (active) setError(err.response?.data?.message ?? 'No se pudieron cargar las evaluaciones.');
            }),
          ]);
        }
      } catch (err: any) {
        if (active) {
          setError(err.response?.data?.message ?? 'No se pudo cargar el contenido del curso.');
        }
      }
    }

    loadCourseContent();
    return () => { active = false; };
  }, [id, location.key]);

  useEffect(() => {
    if (course && location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
    }
  }, [course, location.hash]);

  async function toggleTopicViewed(topicId: string) {
    if (!course || !progress || savingTopicId) return;
    setSavingTopicId(topicId);
    setError(null);
    try {
      setProgress(await setTopicViewed(course.id, topicId, !progress.viewedTopicIds.includes(topicId)));
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo guardar el avance. Intentá nuevamente.');
    } finally {
      setSavingTopicId(null);
    }
  }

  if (error && !course) return <p className="p-6 text-red-600">{error}</p>;
  if (!course) return <p className="p-6">Cargando curso...</p>;

  if (!course.isEnrolled) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-3">
        <p className="text-slate-700">Necesitás estar inscripto para acceder al contenido.</p>
        <Link to={`/cursos/${course.id}`} className="text-slate-800 underline">
          Volver al curso
        </Link>
      </div>
    );
  }

  const closingEvaluations = evaluations.filter((evaluation) => !evaluation.topicId);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <Link to={`/cursos/${course.id}`} className="text-sm text-slate-600 underline">
          Volver al detalle del curso
        </Link>
        <div className="flex flex-wrap items-center gap-x-2 text-xs uppercase text-slate-500">
          <span>{course.category}</span>
          {course.technology && <><span>·</span><span>{course.technology}</span></>}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{course.name}</h1>
        {progress ? <CourseProgressBar progress={progress} /> : (
          <p className="text-sm text-slate-500">{error ? 'Avance no disponible.' : 'Cargando avance...'}</p>
        )}
      </header>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <section aria-labelledby="syllabus-heading" className="space-y-5">
        <h2 id="syllabus-heading" className="text-xl font-semibold">Temario</h2>
        {course.topics.length === 0 ? (
          <p className="text-slate-500">Todavía no hay clases cargadas.</p>
        ) : course.topics.map((topic) => {
          const topicEvaluations = evaluations.filter((evaluation) => evaluation.topicId === topic.id);
          const viewed = progress?.viewedTopicIds.includes(topic.id) ?? false;
          return (
            <article key={topic.id} id={`tema-${topic.id}`} className={`border rounded-lg p-4 space-y-4 ${viewed ? 'border-emerald-500' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900 break-words min-w-0">{topic.order}. {topic.title}</h3>
                <label className={`inline-flex items-center gap-2 text-sm ${viewed ? 'text-emerald-700' : 'text-slate-700'}`}>
                  <input
                    type="checkbox"
                    checked={viewed}
                    disabled={!progress || savingTopicId !== null}
                    onChange={() => toggleTopicViewed(topic.id)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  {savingTopicId === topic.id ? 'Guardando...' : viewed ? 'Visto (desmarcar)' : 'Marcar como visto'}
                </label>
              </div>

              {topic.videoUrl && (
                <div className="space-y-2">
                  <h4 className="font-medium text-slate-800">Video de la clase</h4>
                  <video src={topic.videoUrl} controls preload="metadata" className="w-full rounded bg-black" />
                </div>
              )}

              {topic.screenRecordingUrl && (
                <div className="space-y-2">
                  <h4 className="font-medium text-slate-800">Grabación de pantalla</h4>
                  <video src={topic.screenRecordingUrl} controls preload="metadata" className="w-full rounded bg-black" />
                </div>
              )}

              {topic.materials.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-slate-800">Material de la clase</h4>
                  <ul className="space-y-1">
                    {topic.materials.map((material) => (
                      <li key={material.id}>
                        {material.fileUrl ? (
                          <a href={material.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline break-all">
                            {material.fileName}
                          </a>
                        ) : (
                          <span className="text-slate-500">{material.fileName} (no disponible)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {topic.contentText && (
                <div className="space-y-2">
                  <h4 className="font-medium text-slate-800">Material de lectura</h4>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                    <ReadingMaterial text={topic.contentText} />
                  </div>
                </div>
              )}

              {topicEvaluations.length > 0 && (
                <section className="border-t border-slate-200 pt-3 space-y-2">
                  <h4 className="font-medium text-slate-800">Evaluaciones de esta clase</h4>
                  {topicEvaluations.map((evaluation) => (
                    <div key={evaluation.id} className="flex flex-wrap items-center justify-between gap-3">
                      <span>{evaluation.title}</span>
                      <Link to={`/evaluaciones/${evaluation.id}`} className="text-slate-800 underline">
                        Rendir evaluación
                      </Link>
                    </div>
                  ))}
                </section>
              )}

              {!topic.videoUrl && !topic.screenRecordingUrl && topic.materials.length === 0 && !topic.contentText && topicEvaluations.length === 0 && (
                <p className="text-sm text-slate-500">Esta clase todavía no tiene recursos cargados.</p>
              )}
            </article>
          );
        })}
      </section>

      {closingEvaluations.length > 0 && (
        <section className="border-t border-slate-200 pt-5 space-y-3">
          <h2 className="text-xl font-semibold">Evaluaciones de cierre</h2>
          {closingEvaluations.map((evaluation) => (
            <div key={evaluation.id} className="flex flex-wrap items-center justify-between gap-3">
              <span>{evaluation.title}</span>
              <Link to={`/evaluaciones/${evaluation.id}`} className="text-slate-800 underline">
                Rendir evaluación
              </Link>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}