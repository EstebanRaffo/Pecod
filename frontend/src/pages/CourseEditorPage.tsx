import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import TopicMediaUploader from '../components/TopicMediaUploader';
import EvaluationCreator from '../components/EvaluationCreator';

// ── Icono de lápiz (edición) ────────────────────────────────────────────────
function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );
}

// ── Tipos ───────────────────────────────────────────────────────────────────
interface Material {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
}

interface Topic {
  id: string;
  title: string;
  order: number;
  videoUrl?: string | null;
  screenRecordingUrl?: string | null;
  materials?: Material[];
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
  tools: string | null;
  isPublished: boolean;
  topics: Topic[];
}

// ── Componente de sección con título y botón de edición ─────────────────────
function SectionHeader({
  title,
  onEdit,
  editing,
}: {
  title: string;
  onEdit: () => void;
  editing: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h2 className="font-semibold text-lg">{title}</h2>
      {!editing && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${title}`}
          title="Editar"
          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
        >
          <PencilIcon />
        </button>
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function CourseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

  // Estados de edición por sección
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [editingTools, setEditingTools] = useState(false);
  const [editingTopics, setEditingTopics] = useState(false);
  const [editingEvaluations, setEditingEvaluations] = useState(false);

  // Campos de edición
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftTools, setDraftTools] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');

  // Modal despublicar
  const [showUnpublishModal, setShowUnpublishModal] = useState(false);

  function loadCourse() {
    api.get<CourseDetail>(`/courses/${id}`).then(({ data }) => {
      setCourse(data);
    });
  }

  function loadEvaluations() {
    api.get<Evaluation[]>(`/courses/${id}/evaluations`).then(({ data }) => setEvaluations(data));
  }

  useEffect(() => {
    loadCourse();
    loadEvaluations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Helpers de edición ───────────────────────────────────────────────────
  async function saveField(payload: Record<string, string | null>) {
    if (!course) return;
    await api.patch(`/courses/${course.id}`, payload);
    loadCourse();
  }

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    await saveField({ name: draftName });
    setEditingName(false);
  }

  async function handleSaveDescription(e: FormEvent) {
    e.preventDefault();
    await saveField({ description: draftDescription });
    setEditingDescription(false);
  }

  async function handleSaveCategory(e: FormEvent) {
    e.preventDefault();
    await saveField({ category: draftCategory });
    setEditingCategory(false);
  }

  async function handleSaveTools(e: FormEvent) {
    e.preventDefault();
    await saveField({ tools: draftTools || null });
    setEditingTools(false);
  }

  async function handleAddTopic(e: FormEvent) {
    e.preventDefault();
    if (!course) return;
    const order = course.topics.length + 1;
    await api.post(`/courses/${course.id}/topics`, { title: newTopicTitle, order });
    setNewTopicTitle('');
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
    <div className="max-w-3xl mx-auto p-6 space-y-8">

      {/* ── Encabezado + publicación ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-slate-400 tracking-wide mb-0.5">Detalle del curso</p>
          <h1 className="text-2xl font-bold text-slate-900">{course.name}</h1>
        </div>
        {course.isPublished ? (
          <button
            onClick={() => setShowUnpublishModal(true)}
            className="shrink-0 px-4 py-2 rounded text-white bg-amber-600 hover:bg-amber-700"
          >
            Despublicar
          </button>
        ) : (
          <button
            onClick={handlePublish}
            className="shrink-0 px-4 py-2 rounded text-white bg-green-600 hover:bg-green-700"
          >
            Publicar
          </button>
        )}
      </div>

      {/* ── Nombre ──────────────────────────────────────────────────────── */}
      <section className="border rounded-lg p-4">
        <SectionHeader
          title="Nombre"
          onEdit={() => { setDraftName(course.name); setEditingName(true); }}
          editing={editingName}
        />
        {editingName ? (
          <form onSubmit={handleSaveName} className="flex gap-2">
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              required
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <button type="submit" className="bg-slate-800 text-white px-3 py-2 rounded text-sm">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              className="border px-3 py-2 rounded text-sm"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <p className="text-slate-800">{course.name}</p>
        )}
      </section>

      {/* ── Descripción ─────────────────────────────────────────────────── */}
      <section className="border rounded-lg p-4">
        <SectionHeader
          title="Descripción"
          onEdit={() => { setDraftDescription(course.description); setEditingDescription(true); }}
          editing={editingDescription}
        />
        {editingDescription ? (
          <form onSubmit={handleSaveDescription} className="space-y-2">
            <textarea
              autoFocus
              rows={4}
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              required
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="submit" className="bg-slate-800 text-white px-3 py-2 rounded text-sm">
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditingDescription(false)}
                className="border px-3 py-2 rounded text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <p className="text-slate-700 whitespace-pre-wrap">{course.description}</p>
        )}
      </section>

      {/* ── Área ────────────────────────────────────────────────────────── */}
      <section className="border rounded-lg p-4">
        <SectionHeader
          title="Área"
          onEdit={() => { setDraftCategory(course.category); setEditingCategory(true); }}
          editing={editingCategory}
        />
        {editingCategory ? (
          <form onSubmit={handleSaveCategory} className="flex gap-2">
            <input
              autoFocus
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value)}
              required
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <button type="submit" className="bg-slate-800 text-white px-3 py-2 rounded text-sm">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditingCategory(false)}
              className="border px-3 py-2 rounded text-sm"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <p className="text-slate-800">{course.category}</p>
        )}
      </section>

      {/* ── Tecnología ──────────────────────────────────────────────────── */}
      <section className="border rounded-lg p-4">
        <SectionHeader
          title="Tecnología"
          onEdit={() => { setDraftTools(course.tools ?? ''); setEditingTools(true); }}
          editing={editingTools}
        />
        {editingTools ? (
          <form onSubmit={handleSaveTools} className="flex gap-2">
            <input
              autoFocus
              value={draftTools}
              onChange={(e) => setDraftTools(e.target.value)}
              placeholder="Ej: React, Node.js"
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <button type="submit" className="bg-slate-800 text-white px-3 py-2 rounded text-sm">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditingTools(false)}
              className="border px-3 py-2 rounded text-sm"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <p className="text-slate-800">{course.tools ?? <span className="text-slate-400 italic">Sin especificar</span>}</p>
        )}
      </section>

      {/* ── Temario ─────────────────────────────────────────────────────── */}
      <section className="border rounded-lg p-4">
        <SectionHeader
          title="Temario"
          onEdit={() => setEditingTopics(true)}
          editing={editingTopics}
        />

        <ul className="mb-4 space-y-3">
          {course.topics.map((topic) => (
            <li key={topic.id} className="border rounded px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  {topic.order}. {topic.title}
                </span>
              </div>
              <TopicMediaUploader
                topicId={topic.id}
                videoUrl={topic.videoUrl ?? null}
                screenRecordingUrl={topic.screenRecordingUrl ?? null}
                materials={topic.materials ?? []}
                onChanged={loadCourse}
              />
            </li>
          ))}
          {course.topics.length === 0 && (
            <p className="text-sm text-slate-400 italic">No hay temas cargados aún.</p>
          )}
        </ul>

        {editingTopics && (
          <form onSubmit={handleAddTopic} className="flex gap-2">
            <input
              autoFocus
              placeholder="Título del nuevo tema"
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              required
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <button type="submit" className="bg-slate-800 text-white px-3 py-2 rounded text-sm">
              Agregar
            </button>
            <button
              type="button"
              onClick={() => { setEditingTopics(false); setNewTopicTitle(''); }}
              className="border px-3 py-2 rounded text-sm"
            >
              Cancelar
            </button>
          </form>
        )}
      </section>

      {/* ── Evaluaciones ────────────────────────────────────────────────── */}
      <section className="border rounded-lg p-4">
        <SectionHeader
          title="Evaluaciones"
          onEdit={() => setEditingEvaluations(true)}
          editing={editingEvaluations}
        />

        <ul className="mb-3 space-y-1">
          {evaluations.map((ev) => (
            <li key={ev.id} className="border rounded px-3 py-2 text-sm">
              <span className="font-medium">{ev.title}</span>
              <span className="text-slate-500 ml-2">— mínimo para aprobar: {ev.minScore}</span>
            </li>
          ))}
          {evaluations.length === 0 && (
            <p className="text-sm text-slate-400 italic">No hay evaluaciones creadas aún.</p>
          )}
        </ul>

        {editingEvaluations ? (
          <EvaluationCreator
            courseId={course.id}
            onCreated={() => {
              loadEvaluations();
              setEditingEvaluations(false);
            }}
          />
        ) : null}
      </section>

      {/* ── Modal confirmar despublicación ──────────────────────────────── */}
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
            <p className="text-sm text-slate-600 mb-6">
              El curso dejará de estar disponible para nuevos alumnos. Los ya inscriptos
              conservan su acceso.
            </p>
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
