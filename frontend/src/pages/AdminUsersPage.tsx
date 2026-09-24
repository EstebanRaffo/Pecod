import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

interface Institution {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [form, setForm] = useState({ name: '', email: '', role: 'STUDENT', institutionId: '' });
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Institution[]>('/institutions').then(({ data }) => setInstitutions(data));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      // HU9: nombre, email y rol (Profesor o Alumno), vinculado a una institución
      const { data } = await api.post('/users', form);
      setResult({ email: data.user.email, temporaryPassword: data.temporaryPassword });
      setForm({ name: '', email: '', role: 'STUDENT', institutionId: form.institutionId });
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo crear el usuario.');
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Dar de alta Profesor / Alumno</h1>

      <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3">
        <select
          value={form.institutionId}
          onChange={(e) => setForm({ ...form, institutionId: e.target.value })}
          required
          className="w-full border border-slate-300 rounded px-3 py-2"
        >
          <option value="">Seleccionar institución...</option>
          {institutions.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name}
            </option>
          ))}
        </select>

        <input
          placeholder="Nombre completo"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full border border-slate-300 rounded px-3 py-2"
        >
          <option value="STUDENT">Alumno</option>
          <option value="PROFESSOR">Profesor</option>
        </select>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded">
          Crear usuario
        </button>
      </form>

      {result && (
        <div className="mt-4 border border-green-300 bg-green-50 rounded-lg p-4">
          <p className="font-semibold">Usuario creado.</p>
          <p className="text-sm">
            Compartile estas credenciales iniciales (no se muestran de nuevo):
          </p>
          <p className="text-sm font-mono mt-1">
            {result.email} / {result.temporaryPassword}
          </p>
        </div>
      )}
    </div>
  );
}
