import { FormEvent, useState } from 'react';
import { api } from '../api/client';

interface OptionDraft {
  text: string;
  isCorrect: boolean;
}
interface QuestionDraft {
  text: string;
  options: OptionDraft[];
}

interface Props {
  courseId: string;
  onCreated: () => void;
}

function emptyQuestion(): QuestionDraft {
  return {
    text: '',
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
    ],
  };
}

export default function EvaluationCreator({ courseId, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [minScore, setMinScore] = useState(60);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function updateQuestionText(qIndex: number, text: string) {
    setQuestions((qs) => qs.map((q, i) => (i === qIndex ? { ...q, text } : q)));
  }

  function updateOptionText(qIndex: number, oIndex: number, text: string) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? { ...o, text } : o)) }
          : q,
      ),
    );
  }

  // HU11: "una sola respuesta correcta por pregunta" -> marcar una desmarca las demás.
  function setCorrectOption(qIndex: number, oIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIndex })) }
          : q,
      ),
    );
  }

  function addOption(qIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, { text: '', isCorrect: false }] } : q)),
    );
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, emptyQuestion()]);
  }

  function removeQuestion(qIndex: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== qIndex));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/courses/${courseId}/evaluations`, { title, minScore, questions });
      setTitle('');
      setMinScore(60);
      setQuestions([emptyQuestion()]);
      setOpen(false);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo crear la evaluación.');
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-slate-700 underline text-sm">
        + Crear evaluación
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 mt-3 space-y-4 text-sm">
      <div className="flex gap-2">
        <input
          placeholder="Título de la evaluación"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="flex-1 border border-slate-300 rounded px-3 py-2"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="w-32 border border-slate-300 rounded px-3 py-2"
          title="Puntaje mínimo de aprobación"
        />
      </div>

      {questions.map((q, qIndex) => (
        <div key={qIndex} className="border rounded p-3 space-y-2">
          <div className="flex gap-2">
            <input
              placeholder={`Pregunta ${qIndex + 1}`}
              value={q.text}
              onChange={(e) => updateQuestionText(qIndex, e.target.value)}
              required
              className="flex-1 border border-slate-300 rounded px-3 py-2"
            />
            {questions.length > 1 && (
              <button type="button" onClick={() => removeQuestion(qIndex)} className="text-red-600 text-xs">
                Quitar
              </button>
            )}
          </div>

          {q.options.map((opt, oIndex) => (
            <div key={oIndex} className="flex items-center gap-2 pl-4">
              <input
                type="radio"
                name={`correct-${qIndex}`}
                checked={opt.isCorrect}
                onChange={() => setCorrectOption(qIndex, oIndex)}
                title="Marcar como respuesta correcta"
              />
              <input
                placeholder={`Opción ${oIndex + 1}`}
                value={opt.text}
                onChange={(e) => updateOptionText(qIndex, oIndex, e.target.value)}
                required
                className="flex-1 border border-slate-300 rounded px-2 py-1"
              />
            </div>
          ))}
          <button type="button" onClick={() => addOption(qIndex)} className="pl-4 text-xs text-slate-600 underline">
            + Agregar opción
          </button>
        </div>
      ))}

      <button type="button" onClick={addQuestion} className="text-slate-700 underline">
        + Agregar pregunta
      </button>

      {error && <p className="text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded">
          Guardar evaluación
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded border">
          Cancelar
        </button>
      </div>
    </form>
  );
}
