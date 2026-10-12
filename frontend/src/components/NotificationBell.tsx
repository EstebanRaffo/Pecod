import { useEffect, useRef, useState } from 'react';
import { Bell, Check, LoaderCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContentNotification, getNotifications, markNotificationRead } from '../api/notifications';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<ContentNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  useEffect(() => {
    let active = true;
    let fetching = false;
    async function refresh() {
      if (fetching) return;
      fetching = true;
      try {
        const data = await getNotifications();
        if (active) {
          setNotifications((current) => data.map((notification) => ({
            ...notification,
            readAt: notification.readAt ?? current.find((item) => item.id === notification.id)?.readAt ?? null,
          })).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)));
          setError(null);
        }
      } catch {
        if (active) setError('No se pudieron cargar las notificaciones.');
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    }
    refresh();
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        bell.current?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  async function markRead(id: string) {
    if (readingId) return;
    setReadingId(id);
    setError(null);
    try {
      const updated = await markNotificationRead(id);
      setNotifications((current) => current.map((item) => item.id === id ? updated : item));
    } catch {
      setError('No se pudo marcar como leida. Intenta nuevamente.');
    } finally {
      setReadingId(null);
    }
  }

  return (
    <div ref={container} className="sm:relative shrink-0">
      <button
        ref={bell}
        type="button"
        title="Notificaciones"
        aria-label={`Notificaciones: ${unreadCount} sin leer`}
        aria-expanded={open}
        aria-controls="notifications-panel"
        data-testid="notification-bell"
        onClick={() => {
          if (!open) setReloadKey((current) => current + 1);
          setOpen(!open);
        }}
        className={`relative h-10 w-10 flex items-center justify-center rounded hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${unreadCount ? 'text-red-500' : 'text-white'}`}
      >
        <Bell size={22} aria-hidden="true" />
        {unreadCount > 0 && <span aria-hidden="true" className="absolute right-0 top-0 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <section id="notifications-panel" aria-label="Notificaciones" className="absolute right-3 left-3 top-full mt-2 z-50 sm:left-auto sm:right-0 sm:w-96 border border-slate-200 rounded-lg bg-white text-slate-900 shadow-lg overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold">Notificaciones</h2>
            <button type="button" title="Actualizar notificaciones" aria-label="Actualizar notificaciones" onClick={() => setReloadKey((current) => current + 1)} className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100">
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
          {error && <p role="alert" className="px-4 py-3 text-sm text-red-700">{error}</p>}
          {loading ? <p role="status" className="p-4 text-sm text-slate-500">Cargando...</p> : notifications.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No hay notificaciones.</p>
          ) : (
            <ul className="max-h-[min(28rem,65vh)] overflow-y-auto divide-y divide-slate-200">
              {notifications.map((notification) => (
                <li key={notification.id} data-testid="notification-item" className={`p-4 ${notification.readAt ? 'bg-white' : 'bg-red-50'}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-1 break-words">
                      <p className="font-semibold">{notification.courseName}</p>
                      <p className="text-xs font-medium text-slate-600">{notification.event === 'NEW_CONTENT' ? 'Contenido nuevo' : 'Contenido actualizado'}</p>
                      <Link to={`/mis-cursos/${notification.courseId}${notification.topicId ? `#tema-${notification.topicId}` : ''}`} onClick={() => setOpen(false)} className="block text-sm text-blue-700 underline">{notification.topicTitle}</Link>
                      <time dateTime={notification.createdAt} className="block text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString('es-AR')}</time>
                      <p className="text-xs text-slate-500">{notification.readAt ? 'Leida' : 'Sin leer'}</p>
                    </div>
                    {!notification.readAt && (
                      <button type="button" title="Marcar como leida" aria-label={`Marcar como leida: ${notification.topicTitle}`} disabled={readingId !== null} onClick={() => markRead(notification.id)} className="h-8 w-8 shrink-0 flex items-center justify-center rounded text-slate-600 hover:bg-red-100 disabled:opacity-50">
                        {readingId === notification.id ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}