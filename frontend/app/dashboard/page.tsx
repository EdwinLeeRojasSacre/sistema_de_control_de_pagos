import Image from 'next/image';
import Link from 'next/link';

import type {
  ReactNode,
  SVGProps,
} from 'react';

/* ============================================================
   ICONOS
============================================================ */

function FamilyIcon(
  props: SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      {...props}
    >
      <circle
        cx="9"
        cy="8"
        r="3"
      />

      <circle
        cx="17"
        cy="9"
        r="2.5"
      />

      <path d="M3.5 20c.4-4 2.4-6 5.5-6s5.1 2 5.5 6" />

      <path d="M14.5 15.2c.8-.8 1.7-1.2 2.8-1.2 2.2 0 3.6 1.6 3.9 4.5" />
    </svg>
  );
}

function EnrollmentIcon(
  props: SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      {...props}
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />

      <path d="M4 5.5v16" />

      <path d="M8 7h8" />

      <path d="M8 11h6" />
    </svg>
  );
}

function AcademicIcon(
  props: SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      {...props}
    >
      <path d="m3 10 9-5 9 5-9 5z" />

      <path d="M7 12.5V17c3 2.2 7 2.2 10 0v-4.5" />

      <path d="M21 10v6" />
    </svg>
  );
}

function PaymentIcon(
  props: SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      {...props}
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />

      <path d="M3 9h18" />

      <path d="M7 15h4" />
    </svg>
  );
}

function ReportIcon(
  props: SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      {...props}
    >
      <path d="M4 20V10" />

      <path d="M10 20V4" />

      <path d="M16 20v-7" />

      <path d="M22 20H2" />
    </svg>
  );
}

function ArrowIcon(
  props: SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12h14" />

      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

function CheckIcon(
  props: SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      {...props}
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

/* ============================================================
   CARD DE MÓDULO
============================================================ */

interface ModuleCardProps {
  title: string;
  description: string;
  href: string;
  icon: (
    props: SVGProps<SVGSVGElement>,
  ) => ReactNode;
}

function ModuleCard({
  title,
  description,
  href,
  icon: Icon,
}: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="group block h-full"
    >
      <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:shadow-lg hover:shadow-slate-200/70">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-800 transition group-hover:bg-red-800 group-hover:text-white">
            <Icon className="h-6 w-6" />
          </div>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            Disponible
          </span>
        </div>

        <div className="mt-5 flex-1">
          <h3 className="text-base font-bold text-slate-900">
            {title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-red-800">
          Ingresar

          <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

/* ============================================================
   ACCESO RÁPIDO
============================================================ */

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50/40"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 transition group-hover:text-red-800">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <ArrowIcon className="ml-4 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-red-800" />
    </Link>
  );
}

/* ============================================================
   CARACTERÍSTICA
============================================================ */

function FeatureItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700">
        <CheckIcon className="h-4 w-4" />
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-800">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
============================================================ */

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Presentación */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-950 via-red-800 to-red-700 px-6 py-8 text-white shadow-xl shadow-slate-300/30 sm:px-8 lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" />

        <div className="pointer-events-none absolute -bottom-32 right-32 h-72 w-72 rounded-full bg-white/5 blur-2xl" />

        <div className="pointer-events-none absolute left-1/3 top-0 h-52 w-52 rounded-full bg-slate-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-white" />

              <span className="text-xs font-semibold tracking-wide text-red-50">
                Sistema de Control de Pagos
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Sistema de Control de Pagos
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-red-100 sm:text-base">
              Gestiona la información familiar,
              académica y administrativa de la
              I.E.I. Cuna Jardín N.° 85 desde un
              único sistema.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/dashboard/family-groups/new"
                className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-red-800 shadow-sm transition hover:bg-slate-100"
              >
                Registrar familia
              </Link>

              <Link
                href="/dashboard/payments"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Ir a pagos
              </Link>
            </div>
          </div>

          <div className="hidden shrink-0 lg:block">
            <div className="flex h-44 w-40 items-center justify-center rounded-3xl border border-white/20 bg-white p-3 shadow-2xl shadow-red-950/40">
              <Image
                src="/images/insignia-jardin-85.png"
                alt="Insignia de la I.E.I. Cuna Jardín N.° 85 María Inmaculada Concepción"
                width={180}
                height={210}
                priority
                className="max-h-full w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Módulos */}
      <section>
        <div className="mb-5">
          <p className="text-sm font-semibold text-red-800">
            Gestión institucional
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Módulos del sistema
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Accede a las principales operaciones
            disponibles en el Sistema de Control de Pagos.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ModuleCard
            title="Registro Familiar"
            description="Gestiona familias, apoderados, integrantes y estudiantes vinculados."
            href="/dashboard/family-groups"
            icon={FamilyIcon}
          />

          <ModuleCard
            title="Matrículas"
            description="Consulta y administra la matrícula anual y la asignación académica."
            href="/dashboard/enrollments"
            icon={EnrollmentIcon}
          />

          <ModuleCard
            title="Administración"
            description="Gestiona períodos escolares, estructura académica, aulas y configuración institucional."
            href="/dashboard/administration"
            icon={AcademicIcon}
          />

          <ModuleCard
            title="Pagos"
            description="Registra y consulta pagos de APAFA y Taller con sus respectivos vouchers."
            href="/dashboard/payments"
            icon={PaymentIcon}
          />

          <ModuleCard
            title="Reportes"
            description="Consulta indicadores y estados consolidados por período escolar."
            href="/dashboard/reports"
            icon={ReportIcon}
          />
        </div>
      </section>

      {/* Gestión integrada + accesos */}
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div>
            <p className="text-sm font-semibold text-red-800">
              Sistema de Control de Pagos
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Gestión integrada
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              La información se mantiene centralizada
              para facilitar el trabajo administrativo
              y conservar la trazabilidad de las
              operaciones realizadas.
            </p>
          </div>

          <div className="mt-7 grid gap-6 sm:grid-cols-2">
            <FeatureItem
              title="Registro familiar"
              description="Familias, apoderados y estudiantes gestionados desde un único registro."
            />

            <FeatureItem
              title="Gestión académica"
              description="Matrículas, períodos escolares, grados, aulas y turnos."
            />

            <FeatureItem
              title="Control de pagos"
              description="Seguimiento de APAFA por familia y Taller por estudiante."
            />

            <FeatureItem
              title="Trazabilidad"
              description="Operaciones y cambios importantes registrados mediante auditoría."
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold text-slate-900">
            Accesos rápidos
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Operaciones frecuentes del sistema.
          </p>

          <div className="mt-5 space-y-3">
            <QuickLink
              href="/dashboard/family-groups/new"
              title="Registrar familia"
              description="Crear un nuevo registro familiar."
            />

            <QuickLink
              href="/dashboard/family-groups"
              title="Consultar familias"
              description="Buscar y revisar familias existentes."
            />

            <QuickLink
              href="/dashboard/enrollments"
              title="Consultar matrículas"
              description="Revisar matrículas y asignaciones académicas."
            />

            <QuickLink
              href="/dashboard/payments"
              title="Gestionar pagos"
              description="Registrar APAFA, Taller y vouchers."
            />

            <QuickLink
              href="/dashboard/reports"
              title="Consultar reportes"
              description="Revisar información consolidada por período."
            />
          </div>
        </div>
      </section>
    </div>
  );
}
