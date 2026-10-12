import { FormEvent, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '../api/client';

interface EvaluationDetail {
  id: string;
  questions: {
    id: string;
    text: string;
    options: { id: string; text: string; isCorrect: boolean }[];
  }[];
}

interface EditingField {
  id: string;
  kind: 'questions' | 'options';
  label: string;
  text: string;
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
    if (!editing || !editing.text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.patch<EvaluationDetail>(
        `/evaluations/${evaluationId}/${editing.kind}/${editing.id}`,
        { text: editing.text },
      );
      setDetail(data);
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
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !editing.text.trim()}
              className="bg-slate-800 text-white px-3 py-2 rounded text-sm disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" disabled={saving}
              onClick={() => { setEditing(null); setError(null); }}
              className="border px-3 py-2 rounded text-sm disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </form>
      );
    }
    return (
      <div className="flex items-start justify-between gap-2 min-w-0">
        <p className="whitespace-pre-wrap break-words min-w-0">{text}</p>
        <button type="button" title={`Editar ${label.toLowerCase()}`}
          aria-label={`Editar ${label.toLowerCase()}`} disabled={!!editing}
          onClick={() => { setEditing({ id, kind, text, label }); setError(null); }}
          className="shrink-0 p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50">
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t pt-3" aria-label="Detalle de evaluación">
      {error && <p role="alert" className="text-sm text-red-600 mb-2">{error}</p>}
      {!detail && !error && <p role="status" className="text-slate-500">Cargando evaluación...</p>}
      {detail && <ol className="space-y-4">
        {detail.questions.map((question, index) => (
          <li key={question.id} className="min-w-0">
            <h3 className="font-semibold mb-1">Pregunta {index + 1}</h3>
            {field(question.id, 'questions', question.text, `Pregunta ${index + 1}`)}
            <ul className="mt-2 pl-3 border-l space-y-2">
              {question.options.map((option, optionIndex) => (
                <li key={option.id} className="min-w-0">
                  <p className="text-xs text-slate-500 mb-1">
                    Respuesta {optionIndex + 1}{option.isCorrect && <span className="text-green-700 ml-2">Correcta</span>}
                  </p>
                  {field(option.id, 'options', option.text, `Respuesta ${optionIndex + 1} de pregunta ${index + 1}`)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>}
    </div>
  );
}