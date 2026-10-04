'use client';

import { useEffect, useState } from 'react';
import { getMyProfile, updateMyProfile, type MyProfile, type UpdateMyProfile } from '@/services/users.service';

const emptyForm: UpdateMyProfile = {
  documentType: 'DNI', documentNumber: '', firstName: '', lastNameFather: '', lastNameMother: '', gender: '', phone: '', email: '',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<UpdateMyProfile>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void getMyProfile()
      .then((result) => {
        setProfile(result);
        setForm({
          documentType: result.person.documentType,
          documentNumber: result.person.documentNumber ?? '',
          firstName: result.person.firstName,
          lastNameFather: result.person.lastNameFather ?? '',
          lastNameMother: result.person.lastNameMother ?? '',
          gender: result.person.gender ?? '',
          phone: result.person.phone ?? '',
          email: result.person.email ?? '',
        });
      })
      .catch(() => setError('No se pudo cargar el perfil.'))
      .finally(() => setLoading(false));
  }, []);

  function change(field: keyof UpdateMyProfile, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError(''); setSuccess('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const updated = await updateMyProfile(form);
      setProfile(updated);
      setSuccess('Perfil actualizado correctamente.');
    } catch { setError('No se pudo actualizar el perfil. Verifique los datos ingresados.'); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-slate-500">Cargando perfil…</p>;
  if (!profile) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100';
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6"><p className="text-sm font-semibold text-red-700">Cuenta personal</p><h1 className="text-3xl font-bold text-slate-900">Mi perfil</h1><p className="mt-2 text-sm text-slate-600">Mantén actualizados tus datos personales y de contacto.</p></div>
      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <section>
          <h2 className="font-semibold text-slate-900">Datos de cuenta</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ReadOnly label="Usuario" value={profile.username} />
            <ReadOnly label="Rol" value={profile.role.name || profile.role.code} />
          </div>
        </section>
        <section className="border-t border-slate-200 pt-6">
          <h2 className="font-semibold text-slate-900">Datos personales y contacto</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Nombres<input required value={form.firstName ?? ''} onChange={(e) => change('firstName', e.target.value)} className={inputClass}/></label>
            <label className="text-sm font-medium text-slate-700">Apellido paterno<input value={form.lastNameFather ?? ''} onChange={(e) => change('lastNameFather', e.target.value)} className={inputClass}/></label>
            <label className="text-sm font-medium text-slate-700">Apellido materno<input value={form.lastNameMother ?? ''} onChange={(e) => change('lastNameMother', e.target.value)} className={inputClass}/></label>
            <label className="text-sm font-medium text-slate-700">Género<select value={form.gender ?? ''} onChange={(e) => change('gender', e.target.value)} className={inputClass}><option value="">Sin registrar</option><option value="M">Masculino</option><option value="F">Femenino</option><option value="NO_ESPECIFICA">Prefiere no especificar</option></select></label>
            <label className="text-sm font-medium text-slate-700">Tipo de documento<select required value={form.documentType ?? 'DNI'} onChange={(e) => change('documentType', e.target.value)} className={inputClass}><option value="DNI">DNI</option><option value="CE">Carné de Extranjería</option><option value="PASAPORTE">Pasaporte</option></select></label>
            <label className="text-sm font-medium text-slate-700">Número de documento<input required value={form.documentNumber ?? ''} onChange={(e) => change('documentNumber', e.target.value)} maxLength={20} className={inputClass}/></label>
            <label className="text-sm font-medium text-slate-700">Teléfono<input value={form.phone ?? ''} onChange={(e) => change('phone', e.target.value)} maxLength={30} className={inputClass}/></label>
            <label className="text-sm font-medium text-slate-700">Correo<input type="email" value={form.email ?? ''} onChange={(e) => change('email', e.target.value)} maxLength={200} className={inputClass}/></label>
          </div>
        </section>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
        <div className="flex justify-end"><button disabled={saving} className="rounded-lg bg-red-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </form>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm font-medium text-slate-700">{label}</p><p className="mt-1 min-h-10 rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-sm text-slate-700">{value}</p></div>;
}
