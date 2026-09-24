import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

interface Option {
  id: string;
  text: string;
}
interface Question {
  id: string;
  text: string;
  options: Option[];
}
interface EvaluationForTaking {
  id: string;
  title: string;
  minScore: number;
  attemptsUsed: number;
  maxAttempts: number;
  questions: Question[];
}
interface SubmitResult {
  score: number;
  passed: boolean;
  feedback: { questionId: string; correct: boolean }[];
}

export default function EvaluationPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const [evaluation, setEvaluation] = useState<EvaluationForTaking | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<EvaluationForTaking>(`/evaluations/${evaluationId}/take`)
      .then(({ data }) => setEvaluation(data))
      .catch((err) => setError(err.response?.data?.message ?? 'No se pudo cargar la evaluación.'));
  }, [evaluationId]);

  async function handleSubmit() {
    setError(null);
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, selectedOptionId]) => ({
          questionId,
          selectedOptionId,
        })),
      };
      const { data } = await api.post<SubmitResult>(`/evaluations/${evaluationId}/submit`, payload);
      setResult(data);
    } catch (err: any) {
      // HU12: evaluación ya aprobada / límite de 2 intentos alcanzado
      setError(err.response?.data?.message ?? 'No se pudo enviar la evaluación.');
    }
  }

  if (error && !evaluation) return <p className="p-6 text-red-600">{error}</p>;
  if (!evaluation) return <p className="p-6">Cargando...</p>;

  if (result) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Resultado</h1>
        <p className="text-lg mb-4">
          Puntaje: <strong>{result.score}</strong> (mínimo para aprobar: {evaluation.minScore}) —{' '}
          <span className={result.passed ? 'text-green-700' : 'text-red-700'}>
            {result.passed ? 'Aprobado' : 'Desaprobado'}
          </span>
        </p>
        <ul className="space-y-1">
          {result.feedback.map((f, i) => (
            <li key={f.questionId} className={f.correct ? 'text-green-700' : 'text-red-700'}>
              Pregunta {i + 1}: {f.correct ? 'Correcta' : 'Incorrecta'}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-1">{evaluation.title}</h1>
      <p className="text-sm text-slate-500 mb-6">
        Intento {evaluation.attemptsUsed + 1} de {evaluation.maxAttempts}
      </p>

      {evaluation.questions.map((q, i) => (
        <div key={q.id} className="mb-4 border rounded-lg p-4">
          <p className="font-medium mb-2">
            {i + 1}. {q.text}
          </p>
          {q.options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 mb-1">
              <input
                type="radio"
                name={q.id}
                value={opt.id}
                checked={answers[q.id] === opt.id}
                onChange={() => setAnswers({ ...answers, [q.id]: opt.id })}
              />
              {opt.text}
            </label>
          ))}
        </div>
      ))}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={Object.keys(answers).length !== evaluation.questions.length}
        className="bg-slate-800 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Enviar evaluación
      </button>
    </div>
  );
}
