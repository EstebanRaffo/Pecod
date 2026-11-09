import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as forumApi from '../api/forum';
import { getTopics } from '../api/topics';
import { ConfirmDialog } from '../components/ConfirmDialog';

// HU25: Página del foro por curso

interface Topic {
  id: string;
  title: string;
}

export function ForumPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();

  const [threads, setThreads] = useState<forumApi.ForumThread[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [showNewThreadForm, setShowNewThreadForm] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({ topicId: '', title: '', body: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  // Cargar temas del curso
  useEffect(() => {
    async function loadTopics() {
      if (!courseId) return;
      try {
        const topicList = await getTopics(courseId);
        setTopics(topicList);
      } catch (err) {
        console.error('Error loading topics:', err);
      }
    }
    loadTopics();
  }, [courseId]);

  // Cargar consultas del foro
  useEffect(() => {
    async function loadThreads() {
      if (!courseId || !user) return;
      setLoading(true);
      setError(null);
      try {
        const response = await forumApi.getThreads(courseId, currentPage, selectedTopicId || undefined);
        setThreads(response.data);
        setTotalPages(response.pagination.totalPages);
      } catch (err) {
        setError((err as Error).message || 'Error loading forum');
      } finally {
        setLoading(false);
      }
    }
    loadThreads();
  }, [courseId, user, currentPage, selectedTopicId]);

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.topicId || !formData.title || !formData.body) {
      setFormError('Todos los campos son obligatorios');
      return;
    }

    if (formData.title.length > 120) {
      setFormError('El título no puede exceder 120 caracteres');
      return;
    }

    if (formData.body.length > 2000) {
      setFormError('El contenido no puede exceder 2000 caracteres');
      return;
    }

    try {
      await forumApi.createThread(courseId!, {
        topicId: formData.topicId,
        title: formData.title,
        body: formData.body,
      });
      setFormData({ topicId: '', title: '', body: '' });
      setShowNewThreadForm(false);
      setCurrentPage(1);
      // Reload threads
      const response = await forumApi.getThreads(courseId!);
      setThreads(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      setFormError((err as Error).message || 'Error creating thread');
    }
  };

  const handleDeleteThread = async () => {
    if (!threadToDelete) return;
    try {
      await forumApi.deleteThread(threadToDelete);
      setThreadToDelete(null);
      // Reload threads
      const response = await forumApi.getThreads(courseId!);
      setThreads(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      setError((err as Error).message || 'Error deleting thread');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-slate-600">Cargando foro...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Foro del curso</h1>
          {user?.role === 'STUDENT' && (
            <button
              onClick={() => setShowNewThreadForm(!showNewThreadForm)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {showNewThreadForm ? 'Cancelar' : 'Nueva consulta'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Nuevo formulario de consulta */}
        {showNewThreadForm && (
          <form onSubmit={handleCreateThread} className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Crear nueva consulta
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              {/* Selector de tema */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Tema *
                </label>
                <select
                  value={formData.topicId}
                  onChange={(e) => setFormData({ ...formData, topicId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Selecciona un tema</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Título ({formData.title.length}/120) *
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="¿Cuál es tu pregunta?"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Contenido */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Contenido ({formData.body.length}/2000) *
                </label>
                <textarea
                  maxLength={2000}
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Describe tu pregunta con detalle..."
                  rows={5}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewThreadForm(false);
                    setFormData({ topicId: '', title: '', body: '' });
                    setFormError(null);
                  }}
                  className="px-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Publicar
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filtro por tema */}
        <div className="mb-4">
          <select
            value={selectedTopicId}
            onChange={(e) => {
              setSelectedTopicId(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todos los temas</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </div>

        {/* Listado de consultas */}
        <div className="space-y-3">
          {threads.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-slate-400 py-8">
              No hay consultas en el foro
            </p>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.id}
                className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <button
                    onClick={() => setSelectedThread(thread.id)}
                    className="text-left flex-1 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
                      {thread.title}
                    </h3>
                  </button>
                  {(user?.userId === thread.author || user?.role === 'PROFESSOR') && (
                    <button
                      onClick={() => setThreadToDelete(thread.id)}
                      className="ml-2 px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <span>{thread.topic || 'Tema eliminado'}</span>
                  <span>Por: {thread.author}</span>
                  <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
                  <span>{thread.replyCount} respuesta{thread.replyCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
            >
              Anterior
            </button>
            <div className="px-4 py-2">
              Página {currentPage} de {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        )}

        {/* Detalle de consulta */}
        {selectedThread && (
          <ForumThreadDetailModal
            threadId={selectedThread}
            courseId={courseId!}
            onClose={() => setSelectedThread(null)}
            onThreadDeleted={() => {
              setSelectedThread(null);
              const response = forumApi.getThreads(courseId!);
              response.then((res) => {
                setThreads(res.data);
                setTotalPages(res.pagination.totalPages);
              });
            }}
          />
        )}

        {/* Modal de confirmación */}
        {threadToDelete && (
          <ConfirmDialog
            title="Eliminar consulta"
            message="¿Estás seguro de que querés eliminar esta consulta? También se eliminarán todas sus respuestas."
            confirmLabel="Eliminar"
            onConfirm={handleDeleteThread}
            onCancel={() => setThreadToDelete(null)}
          />
        )}
      </div>
    </div>
  );
}

// ── Componente modal de detalle de consulta ────────────────────────────────────

interface ForumThreadDetailModalProps {
  threadId: string;
  courseId: string;
  onClose: () => void;
  onThreadDeleted: () => void;
}

function ForumThreadDetailModal({
  threadId,
  courseId,
  onClose,
  onThreadDeleted,
}: ForumThreadDetailModalProps) {
  const { user } = useAuth();
  const [thread, setThread] = useState<forumApi.ForumThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPostBody, setNewPostBody] = useState('');
  const [postError, setPostError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  useEffect(() => {
    async function loadThread() {
      try {
        const data = await forumApi.getThread(threadId);
        setThread(data);
      } catch (err) {
        setError((err as Error).message || 'Error loading thread');
      } finally {
        setLoading(false);
      }
    }
    loadThread();
  }, [threadId]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostError(null);

    if (!newPostBody.trim()) {
      setPostError('La respuesta no puede estar vacía');
      return;
    }

    if (newPostBody.length > 2000) {
      setPostError('La respuesta no puede exceder 2000 caracteres');
      return;
    }

    try {
      await forumApi.createPost(threadId, { body: newPostBody });
      setNewPostBody('');
      // Reload thread
      const data = await forumApi.getThread(threadId);
      setThread(data);
    } catch (err) {
      setPostError((err as Error).message || 'Error creating post');
    }
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;
    try {
      await forumApi.deletePost(postToDelete);
      setPostToDelete(null);
      // Reload thread
      const data = await forumApi.getThread(threadId);
      setThread(data);
    } catch (err) {
      setError((err as Error).message || 'Error deleting post');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-2xl w-full">
          <p className="text-red-600">{error || 'Error loading thread'}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded border border-slate-300 dark:border-slate-600"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {thread.title}
            </h2>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
              <span>Tema: {thread.topic}</span>
              <span>Por: {thread.author}</span>
              <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:text-slate-900">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
            {thread.body}
          </p>
          {thread.canDelete && (
            <button
              onClick={() => {
                if (confirm('¿Eliminar esta consulta?')) {
                  forumApi.deleteThread(threadId).then(() => {
                    onClose();
                    onThreadDeleted();
                  });
                }
              }}
              className="mt-4 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            >
              Eliminar consulta
            </button>
          )}
        </div>

        {/* Posts */}
        <div className="p-6 space-y-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            Respuestas ({thread.posts.length})
          </h3>
          {thread.posts.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400 text-sm">No hay respuestas aún</p>
          ) : (
            thread.posts.map((post) => (
              <div
                key={post.id}
                className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded border border-slate-200 dark:border-slate-700"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {post.author}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 ml-2">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {post.canDelete && (
                    <button
                      onClick={() => setPostToDelete(post.id)}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 text-xs rounded"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap break-words">
                  {post.body}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Nueva respuesta */}
        <div className="p-6">
          <form onSubmit={handleCreatePost} className="space-y-3">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Responder</h3>
            {postError && (
              <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{postError}</div>
            )}
            <textarea
              maxLength={2000}
              value={newPostBody}
              onChange={(e) => setNewPostBody(e.target.value)}
              placeholder="Escribe tu respuesta..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {newPostBody.length}/2000 caracteres
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cerrar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Responder
              </button>
            </div>
          </form>
        </div>

        {/* Modal de confirmación de eliminación de post */}
        {postToDelete && (
          <ConfirmDialog
            title="Eliminar respuesta"
            message="¿Estás seguro de que querés eliminar esta respuesta?"
            confirmLabel="Eliminar"
            onConfirm={handleDeletePost}
            onCancel={() => setPostToDelete(null)}
          />
        )}
      </div>
    </div>
  );
}
