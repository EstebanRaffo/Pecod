import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Course {
  id: string;
  name: string;
  category: string;
  tools?: string | null;
  isPublished: boolean;
}

export default function ProfessorCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [technology, setTechnology] = useState('');
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
        tools: technology,
      });
      setName('');
      setDescription('');
      setCategory('');
      setTechnology('');
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo crear el curso.');
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Mis cursos (Profesor)</h1>

      <form onSubmit={handleCreate} className="border rounded-lg p-4 mb-6 space-y-3">
        <h2 className="font-semibold">Crear curso</h2>
        <input
          placeholder="Nombre del curso"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
        <textarea
          placeholder="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
        <input
          placeholder="Área / categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
        <input
          placeholder="Tecnología"
          value={technology}
          onChange={(e) => setTechnology(e.target.value)}
          required
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded">
          Crear curso
        </button>
      </form>

      <div className="space-y-2">
        {courses.map((course) => (
          <Link
            key={course.id}
            to={`/profesor/cursos/${course.id}`}
            className="flex items-center justify-between border rounded-lg p-4 hover:shadow-md transition"
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase text-slate-500">
                <span>{course.category}</span>
                {course.tools && (
                  <>
                    <span>·</span>
                    <span className="normal-case">{course.tools}</span>
                  </>
                )}
              </div>
              <h3 className="font-semibold">{course.name}</h3>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded ${
                course.isPublished ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
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
