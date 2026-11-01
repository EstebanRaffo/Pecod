import type { CourseProgress } from '../api/progress';

export default function CourseProgressBar({ progress }: { progress: CourseProgress }) {
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
        <span>{progress.viewed} de {progress.total} temas vistos</span>
        <span className="font-semibold">{progress.percentage}%</span>
      </div>
      <progress
        aria-label="Avance del curso"
        value={progress.percentage}
        max={100}
        className="block h-2 w-full overflow-hidden rounded appearance-none [&::-webkit-progress-bar]:bg-slate-200 dark:[&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:bg-emerald-600 [&::-moz-progress-bar]:bg-emerald-600"
      />
    </div>
  );
}