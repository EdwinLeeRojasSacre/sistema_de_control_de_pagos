'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordField } from '@/components/forms/password-field';
import { changePassword, getProfile } from '@/services/auth.service';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) return setError('La confirmación no coincide');
    setSaving(true); setError('');
    try {
      await changePassword({ currentPassword, newPassword });
      const profile = await getProfile();
      sessionStorage.setItem('user', JSON.stringify(profile));
      router.replace(profile.role === 'DIRECCION' ? '/dashboard/reports' : '/dashboard');
    } catch { setError('No se pudo cambiar la contraseña. Verifique la contraseña actual y la política indicada.'); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h1 className="text-2xl font-bold text-slate-900">Cambiar contraseña</h1>
    <p className="mt-2 text-sm text-slate-600">Use al menos 10 caracteres, con mayúscula, minúscula y número.</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <PasswordField label="Contraseña actual" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Contraseña actual" inputClassName="w-full rounded-lg border p-3" />
      <PasswordField label="Nueva contraseña" required minLength={10} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nueva contraseña" inputClassName="w-full rounded-lg border p-3" />
      <PasswordField label="Confirmar nueva contraseña" required minLength={10} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Confirmar nueva contraseña" inputClassName="w-full rounded-lg border p-3" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={saving} className="w-full rounded-lg bg-red-800 p-3 font-medium text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Cambiar contraseña'}</button>
    </form>
  </div>;
}
