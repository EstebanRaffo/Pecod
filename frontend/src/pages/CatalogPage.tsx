import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Course {
  id: string;
  name: string;
  description: string;
  category: string;
  tools?: string | null;
}

export default function CatalogPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [category, setCategory] = useState('');
  const [technology, setTechnology] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadCourses() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (category.trim()) params.category = category.trim();
    if (technology.trim()) params.technology = technology.trim();
    const { data } = await api.get<Course[]>('/courses', { params });
    setCourses(data);
    setLoading(false);
  }

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    loadCourses();
  }

  function clearFilters() {
    setCategory('');
    setTechnology('');
    // se recarga sin filtros
    setLoading(true);
    api.get<Course[]>('/courses').then(({ data }) => {
      setCourses(data);
      setLoading(false);
    });
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Catálogo de cursos</h1>

      <form onSubmit={handleFilter} className="flex gap-2 mb-6">
        <input
          placeholder="Área / categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-slate-300 rounded px-3 py-2 flex-1"
        />
        <input
          placeholder="Tecnología"
          value={technology}
          onChange={(e) => setTechnology(e.target.value)}
          className="border border-slate-300 rounded px-3 py-2 flex-1"
        />
        <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded">
          Filtrar
        </button>
        <button type="button" onClick={clearFilters} className="border px-4 py-2 rounded">
          Limpiar
        </button>
      </form>

      {loading ? (
        <p>Cargando...</p>
      ) : courses.length === 0 ? (
        // HU1: mensaje claro de "sin resultados"
        <p className="text-slate-500">Sin resultados.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Link
              key={course.id}
              to={`/cursos/${course.id}`}
              className="block border rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between text-xs uppercase text-slate-500 mb-1">
                <span>{course.category}</span>
                {course.tools && (
                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-medium normal-case">
                    {course.tools}
                  </span>
                )}
              </div>
              <h2 className="font-semibold text-lg">{course.name}</h2>
              <p className="text-sm text-slate-600 line-clamp-2">{course.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
