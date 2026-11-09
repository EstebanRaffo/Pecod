import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

interface Institution {
  id: string;
  name: string;
  domain: string;
  emailDomains?: Array<{ id: string; domain: string }>;
}

export default function AdminInstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [form, setForm] = useState({ name: '', domain: '', address: '', phone: '', contactEmail: '', emailDomains: [] as string[] });
  const [emailDomainInput, setEmailDomainInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingInstitutionId, setEditingInstitutionId] = useState<string | null>(null);
  const [editingEmailDomains, setEditingEmailDomains] = useState<string[]>([]);
  const [editingEmailDomainInput, setEditingEmailDomainInput] = useState('');

  function loadInstitutions() {
    api.get<Institution[]>('/institutions').then(({ data }) => setInstitutions(data));
  }

  useEffect(loadInstitutions, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      // HU9 + HU23: nombre, dominio/subdominio único, dirección, teléfono, email de contacto, y dominios de email
      await api.post('/institutions', { ...form, emailDomains: form.emailDomains.length > 0 ? form.emailDomains : undefined });
      setForm({ name: '', domain: '', address: '', phone: '', contactEmail: '', emailDomains: [] });
      setEmailDomainInput('');
      loadInstitutions();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo crear la institución.');
    }
  }

  function addEmailDomain(e: FormEvent) {
    e.preventDefault();
    const trimmedDomain = emailDomainInput.trim().toLowerCase();
    if (trimmedDomain && !form.emailDomains.includes(trimmedDomain)) {
      setForm({ ...form, emailDomains: [...form.emailDomains, trimmedDomain] });
      setEmailDomainInput('');
    }
  }

  function removeEmailDomain(domain: string) {
    setForm({ ...form, emailDomains: form.emailDomains.filter((d) => d !== domain) });
  }

  async function handleUpdateEmailDomains(e: FormEvent, institutionId: string) {
    e.preventDefault();
    setError(null);
    try {
      // HU23: PATCH para actualizar dominios de email
      await api.patch(`/institutions/${institutionId}/email-domains`, {
        emailDomains: editingEmailDomains,
      });
      setEditingInstitutionId(null);
      setEditingEmailDomains([]);
      loadInstitutions();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudieron actualizar los dominios de email.');
    }
  }

  function startEditingEmailDomains(institution: Institution) {
    setEditingInstitutionId(institution.id);
    setEditingEmailDomains(institution.emailDomains?.map((d) => d.domain) || []);
  }

  function addEditingEmailDomain(e: FormEvent) {
    e.preventDefault();
    const trimmedDomain = editingEmailDomainInput.trim().toLowerCase();
    if (trimmedDomain && !editingEmailDomains.includes(trimmedDomain)) {
      setEditingEmailDomains([...editingEmailDomains, trimmedDomain]);
      setEditingEmailDomainInput('');
    }
  }

  function removeEditingEmailDomain(domain: string) {
    setEditingEmailDomains(editingEmailDomains.filter((d) => d !== domain));
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
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

        {/* HU23: Agregar dominios de email para auto-registro */}
        <div className="border-t border-slate-300 dark:border-slate-600 pt-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dominios de email para auto-registro (opcional)</p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Ej: uade.edu.ar"
              value={emailDomainInput}
              onChange={(e) => setEmailDomainInput(e.target.value)}
              className="flex-1 border border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2"
            />
            <button
              type="button"
              onClick={addEmailDomain}
              className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              Agregar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.emailDomains.map((domain) => (
              <span key={domain} className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded flex items-center gap-2">
                {domain}
                <button
                  type="button"
                  onClick={() => removeEmailDomain(domain)}
                  className="hover:text-red-600 dark:hover:text-red-400 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-700 dark:hover:bg-slate-600">
          Crear institución
        </button>
      </form>

      <div className="space-y-3">
        {institutions.map((inst) => (
          <div key={inst.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{inst.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{inst.domain}</p>

            {/* HU23: Mostrar y editar dominios de email */}
            {editingInstitutionId === inst.id ? (
              <form onSubmit={(e) => handleUpdateEmailDomains(e, inst.id)} className="mt-3 p-3 bg-slate-100 dark:bg-slate-700 rounded space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Editar dominios de email</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej: uade.edu.ar"
                    value={editingEmailDomainInput}
                    onChange={(e) => setEditingEmailDomainInput(e.target.value)}
                    className="flex-1 border border-slate-300 dark:border-slate-500 dark:bg-slate-600 dark:text-white dark:placeholder-slate-400 rounded px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addEditingEmailDomain}
                    className="bg-blue-600 dark:bg-blue-700 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 dark:hover:bg-blue-600"
                  >
                    Agregar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingEmailDomains.map((domain) => (
                    <span key={domain} className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded flex items-center gap-2 text-sm">
                      {domain}
                      <button
                        type="button"
                        onClick={() => removeEditingEmailDomain(domain)}
                        className="hover:text-red-600 dark:hover:text-red-400 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-600 dark:bg-green-700 text-white px-3 py-2 rounded text-sm hover:bg-green-700 dark:hover:bg-green-600"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingInstitutionId(null)}
                    className="bg-slate-400 dark:bg-slate-600 text-white px-3 py-2 rounded text-sm hover:bg-slate-500 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dominios habilitados para auto-registro:</p>
                {inst.emailDomains && inst.emailDomains.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {inst.emailDomains.map((domain) => (
                      <span key={domain.id} className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded text-sm">
                        {domain.domain}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Ninguno (auto-registro deshabilitado)</p>
                )}
                <button
                  type="button"
                  onClick={() => startEditingEmailDomains(inst)}
                  className="bg-slate-600 dark:bg-slate-700 text-white px-3 py-1 rounded text-sm hover:bg-slate-700 dark:hover:bg-slate-600"
                >
                  Editar dominios
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
