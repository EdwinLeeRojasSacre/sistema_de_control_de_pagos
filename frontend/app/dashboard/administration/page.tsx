import Link from 'next/link';

const cards = [
  { href: '/dashboard/administration/users', eyebrow: 'Seguridad', title: 'Usuarios', description: 'Administra cuentas de Secretaría y Dirección, estados y contraseñas.' },
  { href: '/dashboard/administration/school-periods', eyebrow: 'Calendario académico', title: 'Períodos Escolares', description: 'Crea, programa, abre y cierra los períodos académicos.' },
  { href: '/dashboard/administration/academic-structure', eyebrow: 'Oferta anual', title: 'Estructura Académica', description: 'Configura las aulas, niveles y turnos disponibles por período.' },
];

export default function AdministrationPage() {
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold text-slate-900">Administración</h1><p className="mt-1 text-sm text-slate-600">Configuración institucional del Sistema de Control de Pagos.</p></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => <Link key={card.href} href={card.href} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-md">
        <div className="text-sm font-semibold uppercase tracking-wide text-red-800">{card.eyebrow}</div>
        <h2 className="mt-2 text-xl font-bold text-slate-900">{card.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{card.description}</p>
      </Link>)}
    </div>
  </div>;
}
