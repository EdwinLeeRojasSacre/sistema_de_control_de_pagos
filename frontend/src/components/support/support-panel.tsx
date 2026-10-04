import Image from 'next/image';
import type { PublicSupport } from '@/services/support.service';

export function SupportPanel({ support, loading = false }: { support: PublicSupport | null; loading?: boolean }) {
  const hasContact = Boolean(support?.administratorName);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <Image src="/images/insignia-jardin-85.png" alt="Insignia institucional" width={64} height={76} className="max-h-full w-auto object-contain" />
        </div>
        <div>
          <p className="text-xl font-black text-red-800">Sistema de Control de Pagos</p>
          <p className="text-sm font-semibold text-slate-800">Familias · Matrículas · Pagos · Reportes</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">I.E.I. Cuna Jardín N.° 85<br/>“María Inmaculada Concepción” · Chancay</p>
        </div>
      </div>

      <p className="text-sm leading-6 text-slate-600">Aplicación para la gestión de familias, matrículas, pagos y procesos institucionales de educación inicial.</p>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-900">Soporte y administración</h3>
        <p className="mt-1 text-sm leading-5 text-slate-600">Para creación de cuentas, recuperación de acceso o cambios de responsables, comuníquese con el administrador del sistema.</p>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Consultando contacto…</p>
        ) : hasContact ? (
          <dl className="mt-4 grid gap-2 text-sm">
            <div><dt className="font-medium text-slate-500">Administrador del sistema</dt><dd className="text-slate-900">{support?.administratorName}</dd></div>
            <div><dt className="font-medium text-slate-500">Correo</dt><dd className="break-all text-slate-900">{support?.administratorEmail || 'No registrado'}</dd></div>
            {support?.administratorPhone && <div><dt className="font-medium text-slate-500">Teléfono</dt><dd className="text-slate-900">{support.administratorPhone}</dd></div>}
          </dl>
        ) : (
          <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm text-slate-600">Contacto de soporte no configurado.</p>
        )}
      </section>

      {support?.version && <p className="text-center text-xs text-slate-400">Versión del sistema: {support.version}</p>}
    </div>
  );
}
