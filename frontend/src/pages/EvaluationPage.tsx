import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  courseId: string;
  attemptsUsed: number;
  maxAttempts: number;
  questions: Question[];
}
interface SubmitResult {
  score: number;
  passed: boolean;
  feedback: { questionId: string; correct: boolean }[];
  attemptsUsed: number;
  maxAttempts: number;
}

export default function EvaluationPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const navigate = useNavigate();
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

  if (error && !evaluation) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;
  if (!evaluation) return <p className="p-6 text-slate-700 dark:text-slate-300">Cargando...</p>;

  if (result) {
    const canRetry = !result.passed && result.attemptsUsed < result.maxAttempts;

    return (
      <div className="max-w-2xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <h1 className="text-2xl font-semibold mb-2 text-slate-800 dark:text-slate-100">Resultado</h1>
        
        <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          <p className="text-lg mb-4 text-slate-700 dark:text-slate-300">
            Puntaje: <strong>{result.score}</strong> (mínimo para aprobar: {evaluation.minScore}) —{' '}
            <span className={result.passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
              {result.passed ? 'Aprobado' : 'Desaprobado'}
            </span>
          </p>

          <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-700 rounded">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <strong>Intentos realizados:</strong> {result.attemptsUsed} de {result.maxAttempts}
            </p>
          </div>

          <div className="mb-4">
            <p className="font-medium text-slate-800 dark:text-slate-200 mb-2">Detalle de respuestas:</p>
            <ul className="space-y-1">
              {result.feedback.map((f, i) => (
                <li key={f.questionId} className={f.correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                  Pregunta {i + 1}: {f.correct ? 'Correcta' : 'Incorrecta'}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            {canRetry && (
              <button
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                  setError(null);
                  // Recargar la evaluación para obtener attemptsUsed actualizado
                  api
                    .get<EvaluationForTaking>(`/evaluations/${evaluationId}/take`)
                    .then(({ data }) => setEvaluation(data))
                    .catch((err) => setError(err.response?.data?.message ?? 'No se pudo cargar la evaluación.'));
                }}
                className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition"
              >
                Reintentar
              </button>
            )}
            <button
              onClick={() => navigate(`/mis-cursos/${evaluation.courseId}`)}
              className="bg-slate-500 dark:bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-600 dark:hover:bg-slate-500 transition"
            >
              Volver
            </button>
          </div>

          {!result.passed && !canRetry && (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
              <p className="text-sm">Has alcanzado el límite de intentos máximos.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <h1 className="text-2xl font-semibold mb-1 text-slate-800 dark:text-slate-100">{evaluation.title}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Intento {evaluation.attemptsUsed + 1} de {evaluation.maxAttempts}
      </p>

      {evaluation.questions.map((q, i) => (
        <div key={q.id} className="mb-4 border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
          <p className="font-medium mb-2 text-slate-800 dark:text-slate-200">
            {i + 1}. {q.text}
          </p>
          {q.options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 mb-1 text-slate-700 dark:text-slate-300">
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

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={Object.keys(answers).length !== evaluation.questions.length}
        className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
      >
        Enviar evaluación
      </button>
    </div>
  );
}
