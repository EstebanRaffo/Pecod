import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import TopicMediaUploader from '../components/TopicMediaUploader';
import EvaluationCreator from '../components/EvaluationCreator';

interface Topic {
  id: string;
  title: string;
  order: number;
  videoUrl?: string | null;
}

interface Evaluation {
  id: string;
  title: string;
  minScore: number;
}

interface CourseDetail {
  id: string;
  name: string;
  isPublished: boolean;
  topics: Topic[];
}

export default function CourseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [topicTitle, setTopicTitle] = useState('');
  const [showUnpublishModal, setShowUnpublishModal] = useState(false);

  function loadCourse() {
    api.get<CourseDetail>(`/courses/${id}`).then(({ data }) => setCourse(data));
  }

  function loadEvaluations() {
    api.get<Evaluation[]>(`/courses/${id}/evaluations`).then(({ data }) => setEvaluations(data));
  }

  useEffect(() => {
    loadCourse();
    loadEvaluations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddTopic(e: FormEvent) {
    e.preventDefault();
    if (!course) return;
    const order = course.topics.length + 1;
    await api.post(`/courses/${course.id}/topics`, { title: topicTitle, order });
    setTopicTitle('');
    loadCourse();
  }

  async function handlePublish() {
    if (!course) return;
    await api.patch(`/courses/${course.id}/publish`);
    loadCourse();
  }

  async function handleConfirmUnpublish() {
    if (!course) return;
    await api.patch(`/courses/${course.id}/unpublish`);
    setShowUnpublishModal(false);
    loadCourse();
  }

  if (!course) return <p className="p-6">Cargando...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{course.name}</h1>
        {course.isPublished ? (
          <button
            onClick={() => setShowUnpublishModal(true)}
            className="px-4 py-2 rounded text-white bg-amber-600 hover:bg-amber-700"
          >
            Despublicar
          </button>
        ) : (
          <button
            onClick={handlePublish}
            className="px-4 py-2 rounded text-white bg-green-600 hover:bg-green-700"
          >
            Publicar
          </button>
        )}
      </div>

      <h2 className="font-semibold text-lg mb-2">Temario</h2>
      <ul className="mb-4 space-y-3">
        {course.topics.map((topic) => (
          <li key={topic.id} className="border rounded px-3 py-2">
            <div className="flex items-center justify-between">
              <span>
                {topic.order}. {topic.title}
              </span>
              {topic.videoUrl && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Con video</span>
              )}
            </div>
            <TopicMediaUploader topicId={topic.id} hasVideo={!!topic.videoUrl} onChanged={loadCourse} />
          </li>
        ))}
      </ul>

      <form onSubmit={handleAddTopic} className="flex gap-2 mb-8">
        <input
          placeholder="Título del nuevo tema"
          value={topicTitle}
          onChange={(e) => setTopicTitle(e.target.value)}
          required
          className="flex-1 border border-slate-300 rounded px-3 py-2"
        />
        <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded">
          Agregar tema
        </button>
      </form>

      <h2 className="font-semibold text-lg mb-2">Evaluaciones</h2>
      <ul className="mb-3 space-y-1">
        {evaluations.map((ev) => (
          <li key={ev.id} className="border rounded px-3 py-2 text-sm">
            {ev.title} — mínimo para aprobar: {ev.minScore}
          </li>
        ))}
      </ul>
      <EvaluationCreator courseId={course.id} onCreated={loadEvaluations} />

      {showUnpublishModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Confirmar despublicación del curso
            </h3>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowUnpublishModal(false)}
                className="px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmUnpublish}
                className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
