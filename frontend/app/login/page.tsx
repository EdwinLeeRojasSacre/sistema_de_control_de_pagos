'use client';

import axios from 'axios';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PasswordField } from '@/components/forms/password-field';
import { SupportPanel } from '@/components/support/support-panel';
import {
  login,
  saveSession,
} from '@/services/auth.service';
import { getPublicSupport, type PublicSupport } from '@/services/support.service';

export default function LoginPage() {
  const router =
    useRouter();

  const [
    username,
    setUsername,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState('');

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [supportOpen, setSupportOpen] = useState(false);
  const [support, setSupport] = useState<PublicSupport | null>(null);
  const [supportLoading, setSupportLoading] = useState(false);

  async function openSupport() {
    setSupportOpen(true);
    setSupportLoading(true);
    try { setSupport(await getPublicSupport()); }
    catch { setSupport(null); }
    finally { setSupportLoading(false); }
  }

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response =
        await login({
          username,
          password,
        });

      saveSession(response);

      router.replace(
        response.user
          .mustChangePassword
          ? '/dashboard/account/change-password'
          : response.user.role === 'DIRECCION'
            ? '/dashboard/reports'
            : '/dashboard',
      );
    } catch (reason) {
      const serviceUnavailable =
        axios.isAxiosError(reason) &&
        (!reason.response || reason.response.status >= 500);

      setError(
        serviceUnavailable
          ? 'No se pudo conectar con el servidor. Verifica que el servicio esté disponible e inténtalo nuevamente.'
          : 'Usuario o contraseña incorrectos',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-100">
      {/* Fondo decorativo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-red-100/80 blur-3xl" />

        <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-slate-300/50 blur-3xl" />

        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-900 via-red-700 to-red-900" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-400/30 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Panel institucional */}
          <section className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-red-950 via-red-800 to-red-700 px-6 py-10 text-center text-white sm:px-10 lg:min-h-[650px] lg:px-12">
            <div className="pointer-events-none absolute -left-24 top-12 h-60 w-60 rounded-full border border-white/10" />

            <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full border border-white/10" />

            <div className="pointer-events-none absolute right-12 top-12 h-24 w-24 rounded-full bg-white/5 blur-2xl" />

            <div className="relative z-10 flex max-w-md flex-col items-center">
              <div className="mb-6 flex h-44 w-40 items-center justify-center rounded-3xl border border-white/20 bg-white p-3 shadow-2xl shadow-red-950/40 sm:h-48 sm:w-44">
                <Image
                  src="/images/insignia-jardin-85.png"
                  alt="Insignia de la I.E.I. Cuna Jardín N.° 85 María Inmaculada Concepción"
                  width={180}
                  height={210}
                  priority
                  className="max-h-full w-auto object-contain"
                />
              </div>

              <div className="mb-4 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-red-50 uppercase">
                Institución Educativa Inicial
              </div>

              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                Cuna Jardín N.° 85
              </h1>

              <p className="mt-2 text-xl font-semibold text-red-100">
                “María Inmaculada Concepción”
              </p>

              <p className="mt-2 text-sm font-medium tracking-[0.2em] text-red-200 uppercase">
                Chancay
              </p>

              <div className="my-7 h-px w-20 bg-white/30" />

              <p className="text-3xl font-black tracking-tight">
                Sistema de Control de Pagos
              </p>

              <p className="mt-2 max-w-sm text-sm leading-6 text-red-100">
                Familias · Matrículas · Pagos · Reportes
              </p>
            </div>
          </section>

          {/* Formulario */}
          <section className="flex items-center px-6 py-10 sm:px-10 lg:px-14">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8">
                <div className="mb-5 flex items-center gap-3 lg:hidden">
                  <div className="relative h-16 w-14 shrink-0">
                    <Image
                      src="/images/insignia-jardin-85.png"
                      alt="Insignia institucional"
                      fill
                      priority
                      sizes="56px"
                      className="object-contain"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-red-800">
                      I.E.I. Cuna Jardín N.° 85
                    </p>

                    <p className="text-xs text-slate-500">
                      María Inmaculada Concepción
                    </p>
                  </div>
                </div>

                <p className="text-sm font-semibold text-red-700">
                  Bienvenido
                </p>

                <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                  Iniciar sesión
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ingresa tus credenciales para
                  acceder al sistema.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="username"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Usuario o correo
                  </label>

                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    disabled={submitting}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-700 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder="Ingresa tu usuario o correo"
                    value={username}
                    onChange={(event) => {
                      setUsername(
                        event.target.value,
                      );

                      if (error) {
                        setError('');
                      }
                    }}
                  />
                </div>

                <PasswordField
                  id="password"
                  name="password"
                  label="Contraseña"
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                  inputClassName="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-700 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError('');
                  }}
                />

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                      !
                    </div>

                    <p className="text-sm font-medium text-red-700">
                      {error}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center rounded-xl bg-red-800 px-4 py-3 font-semibold text-white shadow-lg shadow-red-900/20 transition hover:bg-red-900 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? 'Ingresando...'
                    : 'Ingresar al sistema'}
                </button>
              </form>

              <div className="mt-8 border-t border-slate-200 pt-6">
                <button type="button" onClick={() => void openSupport()} className="mx-auto block text-center text-sm font-medium text-red-800 transition hover:text-red-950 hover:underline">
                  ¿Necesitas acceso o no puedes ingresar?
                </button>
                <p className="mt-1 text-center text-xs text-slate-500">Contacta al administrador del sistema.</p>
                <p className="text-center text-xs leading-5 text-slate-400">
                  Acceso exclusivo para personal
                  autorizado
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {supportOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="support-title" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Cerrar soporte" onClick={() => setSupportOpen(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-4"><h2 id="support-title" className="text-xl font-bold text-slate-900">Sistema de Control de Pagos / Soporte</h2><button type="button" aria-label="Cerrar soporte" onClick={() => setSupportOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">✕</button></div>
            <SupportPanel support={support} loading={supportLoading}/>
          </div>
        </div>
      )}

      <footer className="pointer-events-none absolute bottom-3 left-0 right-0 hidden text-center text-xs text-slate-400 xl:block">
        Sistema de Control de Pagos · Familias · Matrículas · Pagos · Reportes
      </footer>
    </main>
  );
}
