import { FormEvent, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '../api/client';

interface EvaluationDetail {
  id: string;
  title: string;
  minScore: number;
  maxAttempts: number; // HU19
  questions: {
    id: string;
    text: string;
    options: { id: string; text: string; isCorrect: boolean }[];
  }[];
}

interface EditingField {
  id: string;
  kind: 'questions' | 'options' | 'properties';
  label: string;
  text: string;
  property?: 'minScore' | 'maxAttempts';
  value?: number;
}

export default function EvaluationEditor({ evaluationId }: { evaluationId: string }) {
  const [detail, setDetail] = useState<EvaluationDetail | null>(null);
  const [editing, setEditing] = useState<EditingField | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.get<EvaluationDetail>(`/evaluations/${evaluationId}`)
      .then(({ data }) => { if (active) setDetail(data); })
      .catch(() => { if (active) setError('No se pudo cargar la evaluación.'); });
    return () => { active = false; };
  }, [evaluationId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;

    setSaving(true);
    setError(null);

    try {
      if (editing.kind === 'properties' && editing.property) {
        // HU19: guardar propiedades como minScore, maxAttempts
        const updateData: Record<string, number> = {};
        updateData[editing.property] = editing.value || 0;
        const { data } = await api.patch<EvaluationDetail>(`/evaluations/${evaluationId}`, updateData);
        setDetail(data);
      } else if (!editing.text.trim()) {
        setError('El texto no puede estar vacío.');
        setSaving(false);
        return;
      } else {
        // Editar texto de pregunta/opción
        const { data } = await api.patch<EvaluationDetail>(
          `/evaluations/${evaluationId}/${editing.kind}/${editing.id}`,
          { text: editing.text },
        );
        setDetail(data);
      }
      setEditing(null);
    } catch {
      setError('No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  function field(id: string, kind: EditingField['kind'], text: string, label: string) {
    if (editing?.id === id && editing.kind === kind) {
      return (
        <form onSubmit={save} className="space-y-2 min-w-0">
          <textarea
            autoFocus
            aria-label={label}
            value={editing.text}
            onChange={(event) => setEditing({ ...editing, text: event.target.value })}
            disabled={saving}
            required
            rows={2}
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !editing.text.trim()}
              className="bg-slate-800 dark:bg-slate-700 text-white px-3 py-2 rounded text-sm hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" disabled={saving}
              onClick={() => { setEditing(null); setError(null); }}
              className="border border-slate-300 dark:border-slate-600 dark:text-white px-3 py-2 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </form>
      );
    }
    return (
      <div className="flex items-start justify-between gap-2 min-w-0">
        <p className="whitespace-pre-wrap break-words min-w-0 text-slate-700 dark:text-slate-300">{text}</p>
        <button type="button" title={`Editar ${label.toLowerCase()}`}
          aria-label={`Editar ${label.toLowerCase()}`} disabled={!!editing}
          onClick={() => { setEditing({ id, kind, text, label }); setError(null); }}
          className="shrink-0 p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50">
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  // HU19: componente para editar propiedades numéricas
  function propertyField(property: 'minScore' | 'maxAttempts', label: string, value: number, min: number, max: number) {
    const fieldId = `prop-${property}`;
    if (editing?.id === fieldId && editing.kind === 'properties') {
      return (
        <form onSubmit={save} className="space-y-2 flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor={fieldId} className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              {label}
            </label>
            <input
              id={fieldId}
              type="number"
              min={min}
              max={max}
              autoFocus
              value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })}
              disabled={saving}
              required
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" disabled={saving || editing.value === value}
            className="bg-slate-800 dark:bg-slate-700 text-white px-3 py-2 rounded text-sm hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50">
            {saving ? '...' : 'Ok'}
          </button>
          <button type="button" disabled={saving}
            onClick={() => { setEditing(null); setError(null); }}
            className="border border-slate-300 dark:border-slate-600 dark:text-white px-3 py-2 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50">
            ✕
          </button>
        </form>
      );
    }
    return (
      <div className="flex items-center justify-between">
        <span className="text-slate-700 dark:text-slate-300">{label}: <strong>{value}</strong></span>
        <button type="button" title={`Editar ${label.toLowerCase()}`}
          aria-label={`Editar ${label.toLowerCase()}`} disabled={!!editing}
          onClick={() => { setEditing({ id: fieldId, kind: 'properties', label, text: '', property, value }); setError(null); }}
          className="shrink-0 p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50">
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3" aria-label="Detalle de evaluación">
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}
      {!detail && !error && <p role="status" className="text-slate-500 dark:text-slate-400">Cargando evaluación...</p>}
      {detail && <div className="space-y-4">
        {/* HU19: Panel de propiedades básicas */}
        <div className="bg-slate-100 dark:bg-slate-700 rounded p-3 space-y-2 text-sm">
          <div>{propertyField('minScore', 'Puntaje mínimo para aprobar', detail.minScore, 0, 100)}</div>
          <div>{propertyField('maxAttempts', 'Máximo de intentos', detail.maxAttempts, 1, 5)}</div>
        </div>
        
        <ol className="space-y-4">
          {detail.questions.map((question, index) => (
            <li key={question.id} className="min-w-0">
              <h3 className="font-semibold mb-1 text-slate-800 dark:text-slate-100">Pregunta {index + 1}</h3>
              {field(question.id, 'questions', question.text, `Pregunta ${index + 1}`)}
              <ul className="mt-2 pl-3 border-l border-slate-200 dark:border-slate-700 space-y-2">
                {question.options.map((option, optionIndex) => (
                  <li key={option.id} className="min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Respuesta {optionIndex + 1}{option.isCorrect && <span className="text-green-700 dark:text-green-400 ml-2">Correcta</span>}
                    </p>
                    {field(option.id, 'options', option.text, `Respuesta ${optionIndex + 1} de pregunta ${index + 1}`)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>}
    </div>
  );
}