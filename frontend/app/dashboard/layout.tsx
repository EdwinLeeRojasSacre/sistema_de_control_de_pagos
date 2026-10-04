'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  useCallback,
  useState,
  type ReactNode,
  type SVGProps,
} from 'react';

import { SessionGuard } from '@/components/auth/session-guard';
import { requireLogin } from '@/lib/session';

interface NavigationItem {
  href: string;
  label: string;
  description: string;
  icon: (
    props: SVGProps<SVGSVGElement>,
  ) => ReactNode;
  administrationOnly?: boolean;
  roles?: string[];
}

function DashboardIcon(
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
        y="3"
        width="7"
        height="7"
        rx="1.5"
      />

      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1.5"
      />

      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1.5"
      />

      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1.5"
      />
    </svg>
  );
}

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

      <path d="M16 14v3" />

      <path d="M14.5 15.5h3" />
    </svg>
  );
}

function ReportsIcon(
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
      <path d="M5 20V10" />

      <path d="M12 20V4" />

      <path d="M19 20v-7" />

      <path d="M3 20h18" />
    </svg>
  );
}

function AdministrationIcon(
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
        cx="12"
        cy="12"
        r="3"
      />

      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function MenuIcon(
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
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon(
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
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

const navigationItems: NavigationItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Resumen general',
    icon: DashboardIcon,
  },
  {
    href: '/dashboard/family-groups',
    label: 'Registro Familiar',
    description: 'Familias y apoderados',
    icon: FamilyIcon,
  },
  {
    href: '/dashboard/enrollments',
    label: 'Matrículas',
    description: 'Gestión académica',
    icon: EnrollmentIcon,
  },
  {
    href: '/dashboard/payments',
    label: 'Pagos',
    description: 'APAFA y Taller',
    icon: PaymentIcon,
  },
  {
    href: '/dashboard/reports',
    label: 'Reportes',
    description: 'Control y seguimiento',
    icon: ReportsIcon,
    roles: [
      'ADMINISTRADOR',
      'SECRETARIA',
      'DIRECCION',
    ],
  },
  {
    href: '/dashboard/administration',
    label: 'Administración',
    description: 'Períodos y estructura',
    icon: AdministrationIcon,
    administrationOnly: true,
  },
];

function getRoleLabel(
  role: string | null,
) {
  switch (role) {
    case 'ADMINISTRADOR':
      return 'Administrador';

    case 'SECRETARIA':
      return 'Secretaría';

    case 'DIRECCION':
      return 'Dirección';

    default:
      return 'Usuario';
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname =
    usePathname();

  const [
    role,
    setRole,
  ] = useState<string | null>(
    null,
  );

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  const handleAuthenticated =
    useCallback(
      (profile: {
        role: string;
      }) => {
        setRole(
          profile.role,
        );
      },
      [],
    );

  const canAccessAdministration =
    role === 'ADMINISTRADOR' ||
    role === 'SECRETARIA';

  const availableItems =
    navigationItems.filter(
      (item) =>
        (!item.administrationOnly ||
          canAccessAdministration) &&
        (!item.roles ||
          (role !== null &&
            item.roles.includes(
              role,
            ))) &&
        (role !== 'DIRECCION' ||
          item.href ===
            '/dashboard/reports'),
    );

  function logout() {
    requireLogin();
  }

  function isActive(
    href: string,
  ) {
    if (
      href === '/dashboard'
    ) {
      return (
        pathname === href
      );
    }

    return pathname.startsWith(
      href,
    );
  }

  const sidebarContent = (
    <>
      {/* Identidad */}
      <div className="border-b border-slate-700/70 px-5 py-5">
        <Link
          href="/dashboard"
          onClick={() =>
            setMobileMenuOpen(
              false,
            )
          }
          className="flex items-center gap-3"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white p-1.5 shadow-lg shadow-black/20">
            <Image
              src="/images/insignia-jardin-85.png"
              alt="Insignia institucional"
              width={48}
              height={56}
              priority
              className="max-h-full w-auto object-contain"
            />
          </div>

          <div className="min-w-0">
            <p className="text-lg font-bold tracking-tight text-white">
              Sistema de Control de Pagos
            </p>

            <p className="truncate text-xs text-slate-400">
              Familias · Matrículas · Pagos
            </p>
          </div>
        </Link>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1.5 px-3 py-5">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Navegación
          </p>

          {availableItems.map(
            (item) => {
              const active =
                isActive(
                  item.href,
                );

              const Icon =
                item.icon;

              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  onClick={() =>
                    setMobileMenuOpen(
                      false,
                    )
                  }
                  className={[
                    'group flex items-center gap-3 rounded-xl px-3 py-3 transition',
                    active
                      ? 'bg-red-800 text-white shadow-md shadow-red-950/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  ].join(
                    ' ',
                  )}
                >
                  <div
                    className={[
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition',
                      active
                        ? 'bg-white/15'
                        : 'bg-slate-800 group-hover:bg-slate-700',
                    ].join(
                      ' ',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {
                        item.label
                      }
                    </p>

                    <p
                      className={[
                        'mt-0.5 truncate text-xs',
                        active
                          ? 'text-red-100'
                          : 'text-slate-500',
                      ].join(
                        ' ',
                      )}
                    >
                      {
                        item.description
                      }
                    </p>
                  </div>
                </Link>
              );
            },
          )}
        </nav>

        {/* Usuario */}
        <div className="border-t border-slate-700/70 p-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-800 text-sm font-semibold text-white">
                {role?.charAt(
                  0,
                ) ?? 'U'}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {role === null
                    ? 'Cargando...'
                    : getRoleLabel(
                        role,
                      )}
                </p>

                <p className="text-xs text-slate-400">
                  Sesión activa
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-1 border-t border-slate-700 pt-3">
              {role === 'ADMINISTRADOR' && (
                <Link
                  href="/dashboard/account/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  Mi perfil
                </Link>
              )}
              <Link
                href="/dashboard/about"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                ⓘ Acerca del sistema
              </Link>
            </div>

            <div className="mt-2 flex gap-2 border-t border-slate-700 pt-3">
              <Link
                href="/dashboard/account/change-password"
                className="text-xs font-medium text-red-300 transition hover:text-red-200"
              >
                Contraseña
              </Link>

              <button
                type="button"
                onClick={
                  logout
                }
                className="ml-auto text-xs text-slate-300 transition hover:text-white"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <SessionGuard
      onAuthenticated={
        handleAuthenticated
      }
    >
      <div className="min-h-screen bg-slate-50">
        {/* Sidebar escritorio */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 lg:flex">
          {sidebarContent}
        </aside>

        {/* Sidebar móvil */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() =>
                setMobileMenuOpen(
                  false,
                )
              }
            />

            <aside className="relative flex h-full w-72 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
              <button
                type="button"
                onClick={() =>
                  setMobileMenuOpen(
                    false,
                  )
                }
                className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Cerrar menú"
              >
                <CloseIcon className="h-5 w-5" />
              </button>

              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Contenido */}
        <div className="lg:pl-72">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setMobileMenuOpen(
                      true,
                    )
                  }
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-800 lg:hidden"
                  aria-label="Abrir menú"
                >
                  <MenuIcon className="h-5 w-5" />
                </button>

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Sistema de Control de Pagos
                  </p>

                  <p className="hidden text-xs text-slate-500 sm:block">
                    I.E.I. Cuna Jardín N.° 85
                    · María Inmaculada
                    Concepción
                  </p>
                </div>
              </div>

              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-xs font-medium text-slate-600">
                  Sistema operativo
                </span>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionGuard>
  );
}
