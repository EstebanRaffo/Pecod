import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

interface Institution {
  id: string;
  name: string;
  domain: string;
}

export default function AdminInstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [form, setForm] = useState({ name: '', domain: '', address: '', phone: '', contactEmail: '' });
  const [error, setError] = useState<string | null>(null);

  function loadInstitutions() {
    api.get<Institution[]>('/institutions').then(({ data }) => setInstitutions(data));
  }

  useEffect(loadInstitutions, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      // HU9: nombre, dominio/subdominio único, dirección, teléfono, email de contacto
      await api.post('/institutions', form);
      setForm({ name: '', domain: '', address: '', phone: '', contactEmail: '' });
      loadInstitutions();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo crear la institución.');
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <h1 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-100">Instituciones</h1>

      <form onSubmit={handleCreate} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6 space-y-3 bg-white dark:bg-slate-800">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Nueva institución</h2>
        {(['name', 'domain', 'address', 'phone', 'contactEmail'] as const).map((field) => (
          <input
            key={field}
            placeholder={
              { name: 'Nombre', domain: 'Dominio (ej: uade.pecod.com)', address: 'Dirección', phone: 'Teléfono', contactEmail: 'Email de contacto' }[
                field
              ]
            }
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            required
            className="w-full border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2"
          />
        ))}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600">
          Crear institución
        </button>
      </form>

      <div className="space-y-2">
        {institutions.map((inst) => (
          <div key={inst.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{inst.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{inst.domain}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
