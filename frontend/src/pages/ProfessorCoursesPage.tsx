import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Course {
  id: string;
  name: string;
  category: string;
  technology?: string | null;
  isPublished: boolean;
}

export default function ProfessorCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [technology, setTechnology] = useState('');
  const [academicRequirements, setAcademicRequirements] = useState('');
  const [skills, setSkills] = useState('');
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  function loadCourses() {
    api.get<Course[]>('/courses/mine').then(({ data }) => setCourses(data));
  }

  useEffect(loadCourses, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      // HU5: campos obligatorios (nombre, descripción, área/categoría, tecnología)
      await api.post('/courses', {
        name,
        description,
        category,
        technology,
        academicRequirements,
        skills,
        price: price && price > 0 ? price : undefined,
      });
      setName('');
      setDescription('');
      setCategory('');
      setTechnology('');
      setAcademicRequirements('');
      setSkills('');
      setPrice(undefined);
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo crear el curso.');
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <h1 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-100">Mis cursos (Profesor)</h1>

      <form onSubmit={handleCreate} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6 space-y-3 bg-white dark:bg-slate-800">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Crear curso</h2>
        <input
          placeholder="Nombre del curso"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2"
        />
        <textarea
          placeholder="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2"
        />
        <input
          placeholder="Área / categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2"
        />
        <input
          placeholder="Tecnología"
          value={technology}
          onChange={(e) => setTechnology(e.target.value)}
          required
          className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2"
        />
        <input
          type="number"
          placeholder="Precio en ARS (opcional, dejar vacío para gratuito)"
          value={price ?? ''}
          onChange={(e) => setPrice(e.target.value ? parseFloat(e.target.value) : undefined)}
          step="0.01"
          min="0.01"
          className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2"
        />
        <textarea
          placeholder="Requerimientos Académicos"
          value={academicRequirements}
          onChange={(e) => setAcademicRequirements(e.target.value)}
          className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2"
        />
        <textarea
          placeholder="Aptitudes adquiridas al finalizar el curso"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2"
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600">
          Crear curso
        </button>
      </form>

      <div className="space-y-2">
        {courses.map((course) => (
          <Link
            key={course.id}
            to={`/profesor/cursos/${course.id}`}
            className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-slate-700/50 transition"
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase text-slate-500 dark:text-slate-400">
                <span>{course.category}</span>
                {course.technology && (
                  <>
                    <span>·</span>
                    <span className="normal-case">{course.technology}</span>
                  </>
                )}
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{course.name}</h3>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded ${
                course.isPublished ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {course.isPublished ? 'Publicado' : 'Borrador'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
