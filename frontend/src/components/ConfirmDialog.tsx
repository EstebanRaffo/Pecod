// HU25: Diálogo de confirmación reutilizable
interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Título del diálogo. Por defecto: "Confirmar eliminación" */
  title?: string;
  /** Etiqueta del botón de confirmación. Por defecto: "Eliminar" */
  confirmLabel?: string;
  /** Si es true, el botón de confirmación se muestra con estilo destructivo (rojo). Por defecto: true */
  destructive?: boolean;
}

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  title = 'Confirmar eliminación',
  confirmLabel = 'Eliminar',
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-xl dark:shadow-slate-900/50 w-full max-w-sm mx-4 p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded text-white ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
