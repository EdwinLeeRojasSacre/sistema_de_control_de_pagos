'use client';

import axios from 'axios';
import { useEffect, useState } from 'react';
import { PasswordVisibilityButton } from '@/components/forms/password-field';
import { createUser, getUserOptions, listUsers, lookupPerson, resetUserPassword, setUserStatus, updateUser, type ManagedUser, type NewUserPerson, type PersonLookupResult, type UserOptions } from '@/services/users.service';

const emptyPerson: NewUserPerson = { documentType: '', documentNumber: '', firstName: '', lastNameFather: '', lastNameMother: '', birthDate: '', gender: '', phone: '', email: '', address: '' };

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [options, setOptions] = useState<UserOptions>({ persons: [], roles: [] });
  const [documentType, setDocumentType] = useState('DNI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [lookup, setLookup] = useState<PersonLookupResult | null>(null);
  const [registerNew, setRegisterNew] = useState(false);
  const [person, setPerson] = useState<NewUserPerson>(emptyPerson);
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [resetCredential, setResetCredential] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [editPerson, setEditPerson] = useState<NewUserPerson>(emptyPerson);
  const [editUsername, setEditUsername] = useState('');

  async function load() {
    const [rows, available] = await Promise.all([listUsers(), getUserOptions()]);
    setUsers(rows); setOptions(available);
  }
  useEffect(() => { void load().catch(() => setError('No se pudo cargar la administración de usuarios.')); }, []);

  function errorMessage(reason: unknown, fallback: string) {
    if (axios.isAxiosError(reason)) return (reason.response?.data as { message?: string } | undefined)?.message ?? fallback;
    return fallback;
  }

  async function search(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setResetCredential(null); setRegisterNew(false);
    try {
      const result = await lookupPerson(documentType, documentNumber);
      setLookup(result);
      setPerson({ ...emptyPerson, documentType: documentType.trim().toUpperCase(), documentNumber: documentNumber.trim() });
    } catch (reason) { setLookup(null); setError(errorMessage(reason, 'No se pudo buscar la persona.')); }
    finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setResetCredential(null);
    try {
      const payload = lookup?.found && lookup.person
        ? { personId: lookup.person.id, username, role, isActive }
        : { person, username, role, isActive };
      const result = await createUser(payload);
      setResetCredential({ username, temporaryPassword: result.temporaryPassword });
      setShowTemporaryPassword(false);
      setLookup(null); setRegisterNew(false); setDocumentNumber(''); setUsername(''); setRole(''); setIsActive(true); setPerson(emptyPerson);
      setShowCreate(false);
      await load();
    } catch (reason) { setError(errorMessage(reason, 'No se pudo crear el usuario.')); }
    finally { setBusy(false); }
  }

  async function toggle(user: ManagedUser) {
    setError(''); try { await setUserStatus(user.id, !user.isActive); await load(); } catch (reason) { setError(errorMessage(reason, 'No se pudo actualizar el estado.')); }
  }
  async function reset(user: ManagedUser) {
    setError(''); setResetCredential(null);
    try {
      const result = await resetUserPassword(user.id);
      setResetCredential({ username: user.username, temporaryPassword: result.temporaryPassword });
      setShowTemporaryPassword(false);
    } catch (reason) { setError(errorMessage(reason, 'No se pudo resetear la contraseña.')); }
  }
  function updatePerson(field: keyof NewUserPerson, value: string) { setPerson((current) => ({ ...current, [field]: value })); }

  function beginEdit(user: ManagedUser) {
    setEditing(user); setEditUsername(user.username); setError(''); setShowCreate(false);
    setEditPerson({ documentType: user.person.documentType, documentNumber: user.person.documentNumber ?? '', firstName: user.person.firstName, lastNameFather: user.person.lastNameFather ?? '', lastNameMother: user.person.lastNameMother ?? '', birthDate: user.person.birthDate?.slice(0, 10) ?? '', gender: user.person.gender ?? '', phone: user.person.phone ?? '', email: user.person.email ?? '', address: user.person.address ?? '' });
  }
  async function submitEdit(event: React.FormEvent) {
    event.preventDefault(); if (!editing) return; setBusy(true); setError('');
    try { await updateUser(editing.id, { username: editUsername, person: editPerson }); setEditing(null); await load(); }
    catch (reason) { setError(errorMessage(reason, 'No se pudo editar el usuario.')); }
    finally { setBusy(false); }
  }
  function updateEditPerson(field: keyof typeof editPerson, value: string) { setEditPerson((current) => ({ ...current, [field]: value })); }

  const canCreate = (lookup?.found && lookup.person && !lookup.person.hasUser && lookup.person.isActive) || registerNew;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold text-slate-900">Usuarios</h1><p className="mt-1 text-sm text-slate-600">Administra cuentas de Secretaría y Dirección.</p></div><button type="button" onClick={() => { setShowCreate(true); setEditing(null); }} className="rounded-lg bg-red-800 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-red-900">Nuevo usuario</button></div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {resetCredential && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4"><p className="font-semibold text-amber-900">Credencial temporal generada</p><p className="mt-2 text-sm text-amber-900">Usuario: <strong>{resetCredential.username}</strong></p><div className="my-2 flex items-center gap-2"><p id="temporary-password" className="min-w-0 break-all font-mono text-xl">{showTemporaryPassword ? resetCredential.temporaryPassword : '••••••••••••'}</p><PasswordVisibilityButton visible={showTemporaryPassword} onToggle={() => setShowTemporaryPassword((current) => !current)} controls="temporary-password" className="rounded-lg border border-amber-300 bg-white p-2 text-amber-900"/></div><button type="button" onClick={() => void navigator.clipboard.writeText(resetCredential.temporaryPassword)} className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900">Copiar contraseña exacta</button><p className="mt-2 text-sm text-amber-800">Esta contraseña se mostrará una sola vez.</p></div>}

    {showCreate && <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Nuevo usuario</h2>
      <form onSubmit={search} className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
        <select required value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="rounded-lg border p-2"><option value="DNI">DNI</option><option value="CE">Carné de Extranjería</option><option value="PASAPORTE">Pasaporte</option></select>
        <input required value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Número de documento" className="rounded-lg border p-2" />
        <button disabled={busy} className="rounded-lg bg-slate-700 px-5 py-2 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">Buscar</button>
      </form>

      {lookup?.found && lookup.person && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <p className="font-semibold text-emerald-900">Persona encontrada</p>
        <p>{lookup.person.firstName} {lookup.person.lastNameFather} {lookup.person.lastNameMother}</p>
        <p>{lookup.person.documentType}: {lookup.person.documentNumber}</p>
        <p>Teléfono: {lookup.person.phone || 'No registrado'} · Correo: {lookup.person.email || 'No registrado'}</p>
        {lookup.person.hasUser && <p className="mt-2 font-medium text-red-700">Esta persona ya tiene una cuenta de usuario.</p>}
        {!lookup.person.isActive && <p className="mt-2 font-medium text-red-700">La persona está inactiva y no puede recibir una cuenta.</p>}
      </div>}

      {lookup && !lookup.found && !registerNew && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><p>No se encontró una persona con este documento.</p><button type="button" onClick={() => setRegisterNew(true)} className="mt-3 rounded border border-amber-400 px-3 py-2 font-medium">Registrar nueva persona</button></div>}

      {registerNew && <div className="mt-5"><h3 className="font-semibold">Datos personales</h3><p className="mt-1 text-sm text-slate-500">Registrar nueva persona</p><div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <select required value={person.documentType} onChange={(e) => updatePerson('documentType', e.target.value)} className="rounded-lg border p-2"><option value="DNI">DNI</option><option value="CE">Carné de Extranjería</option><option value="PASAPORTE">Pasaporte</option></select>
        <input required value={person.documentNumber} onChange={(e) => updatePerson('documentNumber', e.target.value)} placeholder="Número documento" className="rounded-lg border p-2" />
        <input required value={person.firstName} onChange={(e) => updatePerson('firstName', e.target.value)} placeholder="Nombres" className="rounded-lg border p-2" />
        <input value={person.lastNameFather} onChange={(e) => updatePerson('lastNameFather', e.target.value)} placeholder="Apellido paterno" className="rounded-lg border p-2" />
        <input value={person.lastNameMother} onChange={(e) => updatePerson('lastNameMother', e.target.value)} placeholder="Apellido materno" className="rounded-lg border p-2" />
        <input type="date" value={person.birthDate} onChange={(e) => updatePerson('birthDate', e.target.value)} className="rounded-lg border p-2" />
        <select value={person.gender} onChange={(e) => updatePerson('gender', e.target.value)} className="rounded-lg border p-2"><option value="">Género sin registrar</option><option value="M">Masculino</option><option value="F">Femenino</option><option value="NO_ESPECIFICA">Prefiere no especificar</option></select>
        <input value={person.phone} onChange={(e) => updatePerson('phone', e.target.value)} placeholder="Teléfono" className="rounded-lg border p-2" />
        <input type="email" value={person.email} onChange={(e) => updatePerson('email', e.target.value)} placeholder="Correo" className="rounded-lg border p-2" />
        <input value={person.address} onChange={(e) => updatePerson('address', e.target.value)} placeholder="Dirección" className="rounded-lg border p-2 md:col-span-2" />
      </div></div>}

      {canCreate && <form onSubmit={submit} className="mt-5 border-t pt-5"><h3 className="font-semibold">Datos de acceso</h3><div className="mt-3 grid gap-3 md:grid-cols-4">
        <input required minLength={3} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" className="rounded-lg border p-2" />
        <select required value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border p-2"><option value="">Seleccione rol</option>{options.roles.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
        <select value={isActive ? 'ACTIVE' : 'INACTIVE'} onChange={(e) => setIsActive(e.target.value === 'ACTIVE')} className="rounded-lg border p-2"><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select>
        <button disabled={busy} className="rounded-lg bg-red-800 px-4 py-2 font-medium text-white disabled:opacity-50">Crear usuario</button>
      </div></form>}
      <button type="button" onClick={() => setShowCreate(false)} className="mt-4 text-sm font-medium text-slate-600 hover:text-slate-900">Cancelar</button>
    </section>}

    {editing && <form onSubmit={submitEdit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-900">Editar usuario</h2><p className="text-sm text-slate-500">{editing.role.name}</p></div><button type="button" onClick={() => setEditing(null)} className="text-sm text-slate-500 hover:text-slate-800">Cerrar</button></div>
      <h3 className="mt-5 border-b pb-2 font-semibold text-slate-800">Datos personales</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <select required value={editPerson.documentType} onChange={(e) => updateEditPerson('documentType', e.target.value)} className="rounded-lg border p-2"><option value="DNI">DNI</option><option value="CE">Carné de Extranjería</option><option value="PASAPORTE">Pasaporte</option></select>
        <input required value={editPerson.documentNumber} onChange={(e) => updateEditPerson('documentNumber', e.target.value)} placeholder="Número documento" maxLength={20} className="rounded-lg border p-2" />
        <input required value={editPerson.firstName} onChange={(e) => updateEditPerson('firstName', e.target.value)} placeholder="Nombres" className="rounded-lg border p-2" />
        <input value={editPerson.lastNameFather} onChange={(e) => updateEditPerson('lastNameFather', e.target.value)} placeholder="Apellido paterno" className="rounded-lg border p-2" />
        <input value={editPerson.lastNameMother} onChange={(e) => updateEditPerson('lastNameMother', e.target.value)} placeholder="Apellido materno" className="rounded-lg border p-2" />
        <input type="date" value={editPerson.birthDate} onChange={(e) => updateEditPerson('birthDate', e.target.value)} className="rounded-lg border p-2" />
        <select value={editPerson.gender ?? ''} onChange={(e) => updateEditPerson('gender', e.target.value)} className="rounded-lg border p-2"><option value="">Género sin registrar</option><option value="M">Masculino</option><option value="F">Femenino</option><option value="NO_ESPECIFICA">Prefiere no especificar</option></select>
        <input value={editPerson.phone} onChange={(e) => updateEditPerson('phone', e.target.value)} placeholder="Teléfono" className="rounded-lg border p-2" />
        <input type="email" value={editPerson.email} onChange={(e) => updateEditPerson('email', e.target.value)} placeholder="Correo" className="rounded-lg border p-2" />
        <input value={editPerson.address} onChange={(e) => updateEditPerson('address', e.target.value)} placeholder="Dirección" className="rounded-lg border p-2 md:col-span-2" />
      </div>
      <h3 className="mt-5 border-b pb-2 font-semibold text-slate-800">Datos de acceso</h3>
      <div className="mt-3 flex flex-wrap items-end gap-3"><label className="flex min-w-64 flex-1 flex-col gap-1 text-sm text-slate-600">Usuario<input required minLength={3} value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="rounded-lg border p-2 text-slate-900" /></label><button disabled={busy} className="rounded-lg bg-red-800 px-5 py-2.5 font-semibold text-white transition hover:bg-red-900 disabled:opacity-50">Guardar cambios</button></div>
    </form>}

    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Persona</th><th className="p-3">Documento</th><th className="p-3">Username</th><th className="p-3">Rol</th><th className="p-3">Estado</th><th className="p-3">Último login</th><th className="p-3">Acciones</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-t"><td className="p-3">{user.person.firstName} {user.person.lastNameFather} {user.person.lastNameMother}</td><td className="p-3">{user.person.documentType} {user.person.documentNumber}</td><td className="p-3">{user.username}</td><td className="p-3">{user.role.name}</td><td className="p-3">{user.isActive ? 'Activo' : 'Inactivo'}</td><td className="p-3">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Nunca'}</td><td className="p-3"><div className="flex flex-wrap gap-2"><button onClick={() => beginEdit(user)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100">Editar</button><button onClick={() => void toggle(user)} className={user.isActive ? 'rounded-md bg-amber-50 px-3 py-1.5 font-medium text-amber-700 transition hover:bg-amber-100' : 'rounded-md bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 transition hover:bg-emerald-100'}>{user.isActive ? 'Desactivar' : 'Activar'}</button><button disabled={!user.isActive} title={!user.isActive ? 'Active el usuario antes de restablecer su contraseña' : undefined} onClick={() => void reset(user)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Restablecer contraseña</button></div></td></tr>)}</tbody></table></div>
  </div>;
}
