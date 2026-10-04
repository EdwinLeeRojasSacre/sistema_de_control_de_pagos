'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAcademicStructure } from '@/services/academic-structure.service';
import { getSchoolPeriods } from '@/services/school-periods.service';
import { exportPaymentsReport, getPaymentsReport, getReportError, getReportSummary } from '@/services/reports.service';
import type { AcademicClassroom, AcademicLevel, AcademicStructure, ShiftOption } from '@/types/academic-structure';
import type { SchoolPeriod } from '@/types/school-periods';
import type { PaymentsReportParams, PaymentsReportResponse, ReportPaymentStatus, ReportSummary } from '@/types/reports';
import { getSchoolPeriodStatusLabel } from '@/lib/school-period-status';

type Tab = 'summary' | 'export';
type PaymentType = 'ALL' | 'APAFA' | 'TALLER';
const PAGE_SIZE = 20;

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('summary');
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [schoolPeriodId, setSchoolPeriodId] = useState('');
  const [structure, setStructure] = useState<AcademicStructure | null>(null);
  const [cycleId, setCycleId] = useState('');
  const [educationLevelId, setEducationLevelId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('ALL');
  const [status, setStatus] = useState<ReportPaymentStatus>('ALL');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [report, setReport] = useState<PaymentsReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSchoolPeriods().then(({ data, currentOpenPeriod }) => {
      setPeriods(data); setSchoolPeriodId(currentOpenPeriod?.id ?? data[0]?.id ?? '');
    }).catch((cause) => setError(getReportError(cause))).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!schoolPeriodId) return;
    setCycleId(''); setEducationLevelId(''); setClassroomId(''); setShiftId('');
    getAcademicStructure(schoolPeriodId).then(setStructure).catch((cause) => setError(getReportError(cause)));
  }, [schoolPeriodId]);

  const levels = useMemo(() => structure?.cycles.filter((cycle) => !cycleId || cycle.id === cycleId).flatMap((cycle) => cycle.levels) ?? [], [structure, cycleId]);
  const classrooms = useMemo(() => levels.filter((level) => !educationLevelId || level.id === educationLevelId).flatMap((level) => level.classrooms), [levels, educationLevelId]);
  const shifts = useMemo(() => [...new Map(classrooms.map((room) => [room.shift.id, room.shift])).values()], [classrooms]);
  const common = useMemo(() => ({ schoolPeriodId, cycleId: cycleId || undefined, educationLevelId: educationLevelId || undefined, classroomId: classroomId || undefined, shiftId: shiftId || undefined, paymentType }), [schoolPeriodId, cycleId, educationLevelId, classroomId, shiftId, paymentType]);
  const params: PaymentsReportParams = useMemo(() => ({ ...common, status, search: appliedSearch || undefined, page, limit: PAGE_SIZE }), [common, status, appliedSearch, page]);

  useEffect(() => {
    if (!schoolPeriodId) return;
    let active = true; setLoading(true); setError(null);
    const request = tab === 'summary' ? getReportSummary(common) : getPaymentsReport(params);
    request.then((value) => { if (active) tab === 'summary' ? setSummary(value as ReportSummary) : setReport(value as PaymentsReportResponse); })
      .catch((cause) => active && setError(getReportError(cause))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [tab, common, params, schoolPeriodId]);

  async function exportFile(format: 'xlsx' | 'pdf') {
    setExporting(true); setError(null);
    try { await exportPaymentsReport({ ...params, page: undefined, limit: undefined }, format); }
    catch (cause) { setError(getReportError(cause)); }
    finally { setExporting(false); }
  }

  return <section className="space-y-6">
    <header className="flex items-center gap-4"><Image src="/images/insignia-jardin-85.png" alt="Insignia del jardín" width={58} height={58} className="h-14 w-14 object-contain"/><div><h1 className="text-3xl font-bold text-slate-900">Reportes</h1><p className="text-sm text-slate-600">Seguimiento ejecutivo y exportación de pagos institucionales.</p></div></header>
    <nav className="flex gap-2 border-b border-slate-200" aria-label="Secciones de reportes">{([['summary', 'Resumen'], ['export', 'Exportar']] as const).map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`border-b-2 px-5 py-3 text-sm font-semibold ${tab === value ? 'border-red-800 text-red-800' : 'border-transparent text-slate-500'}`}>{label}</button>)}</nav>
    <Filters periods={periods} structure={structure} schoolPeriodId={schoolPeriodId} setSchoolPeriodId={setSchoolPeriodId} cycleId={cycleId} setCycleId={setCycleId} levels={levels} educationLevelId={educationLevelId} setEducationLevelId={setEducationLevelId} classrooms={classrooms} classroomId={classroomId} setClassroomId={setClassroomId} shifts={shifts} shiftId={shiftId} setShiftId={setShiftId} paymentType={paymentType} setPaymentType={setPaymentType} exportMode={tab === 'export'} status={status} setStatus={setStatus} search={search} setSearch={setSearch} applySearch={() => { setAppliedSearch(search.trim()); setPage(1); }}/>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading && <p className="text-sm text-slate-500">Actualizando información…</p>}
    {tab === 'summary' && summary && <SummaryView summary={summary} paymentType={paymentType}/>} 
    {tab === 'export' && report && <ExportView report={report} paymentType={paymentType} exporting={exporting} onExport={exportFile} page={page} setPage={setPage}/>} 
  </section>;
}

interface FilterProps { periods: SchoolPeriod[]; structure: AcademicStructure | null; schoolPeriodId: string; setSchoolPeriodId(v:string):void; cycleId:string; setCycleId(v:string):void; levels:AcademicLevel[]; educationLevelId:string; setEducationLevelId(v:string):void; classrooms:AcademicClassroom[]; classroomId:string; setClassroomId(v:string):void; shifts:ShiftOption[]; shiftId:string; setShiftId(v:string):void; paymentType:PaymentType; setPaymentType(v:PaymentType):void; exportMode:boolean; status:ReportPaymentStatus; setStatus(v:ReportPaymentStatus):void; search:string; setSearch(v:string):void; applySearch():void }
function Filters(p: FilterProps) {
  const cls='w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
  const resetAfterCycle=(v:string)=>{p.setCycleId(v);p.setEducationLevelId('');p.setClassroomId('');p.setShiftId('')};
  const resetAfterLevel=(v:string)=>{p.setEducationLevelId(v);p.setClassroomId('');p.setShiftId('')};
  const visibleClassrooms = p.shiftId ? p.classrooms.filter((room) => room.shift.id === p.shiftId) : p.classrooms;
  const changeShift = (value: string) => {
    p.setShiftId(value);
    if (p.classroomId && !p.classrooms.some((room) => room.id === p.classroomId && (!value || room.shift.id === value))) p.setClassroomId('');
  };
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
    <Field label="Período"><select className={cls} value={p.schoolPeriodId} onChange={(e)=>p.setSchoolPeriodId(e.target.value)}>{p.periods.map(x=><option key={x.id} value={x.id}>{x.year}</option>)}</select></Field>
    <Field label="Ciclo"><select className={cls} value={p.cycleId} onChange={(e)=>resetAfterCycle(e.target.value)}><option value="">Todos</option>{p.structure?.cycles.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Nivel"><select className={cls} value={p.educationLevelId} onChange={(e)=>resetAfterLevel(e.target.value)}><option value="">Todos</option>{p.levels.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Turno"><select className={cls} value={p.shiftId} onChange={(e)=>changeShift(e.target.value)}><option value="">Todos</option>{p.shifts.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Aula"><select className={cls} value={p.classroomId} onChange={(e)=>p.setClassroomId(e.target.value)}><option value="">Todas</option>{visibleClassrooms.map(x=><option key={x.id} value={x.id}>{p.shiftId ? x.name : `${x.name} — ${x.shift.name}`}</option>)}</select></Field>
    <Field label="Tipo de pago"><select className={cls} value={p.paymentType} onChange={(e)=>p.setPaymentType(e.target.value as PaymentType)}><option value="ALL">Todos</option><option value="APAFA">APAFA</option><option value="TALLER">Taller</option></select></Field>
    {p.exportMode && <><Field label="Estado"><select className={cls} value={p.status} onChange={(e)=>p.setStatus(e.target.value as ReportPaymentStatus)}><option value="ALL">Todos</option><option value="PAGADO">PAGO</option><option value="NO_PAGADO">DEBE</option></select></Field><div className="sm:col-span-2"><Field label="Búsqueda"><div className="flex gap-2"><input className={`${cls} min-w-0`} value={p.search} onChange={(e)=>p.setSearch(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&p.applySearch()} placeholder="Estudiante o documento"/><button onClick={p.applySearch} className="shrink-0 rounded-md bg-slate-800 px-3 text-sm font-semibold text-white">Buscar</button></div></Field></div></>}
  </div></div>;
}
function Field({label,children}:{label:string;children:ReactNode}){return <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>{children}</label>}

function SummaryView({summary,paymentType}:{summary:ReportSummary;paymentType:PaymentType}){
  const a=paymentType!=='TALLER',t=paymentType!=='APAFA';
  return <div className="grid gap-5 lg:grid-cols-2"><Card title="Información general"><div className="grid grid-cols-3 gap-3"><Metric label="Período" value={summary.schoolPeriod.year} note={getSchoolPeriodStatusLabel(summary.schoolPeriod.status)}/><Metric label="Familias" value={summary.families} note="consideradas"/><Metric label="Estudiantes" value={summary.students} note="considerados"/></div></Card>
    <Card title="Cumplimiento de pagos"><div className="space-y-5">{a&&<Progress label="APAFA" paid={summary.apafa.paid} total={summary.apafa.totalFamilies} percentage={summary.apafa.paidPercentage} unit="familias"/>}{t&&<Progress label="Taller" paid={summary.taller.paid} total={summary.taller.totalStudents} percentage={summary.taller.paidPercentage} unit="estudiantes"/>}</div></Card>
    <Card title="Aulas con más pendientes"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="p-2">Aula</th>{a&&<th className="p-2">APAFA pendiente</th>}{t&&<th className="p-2">Taller pendiente</th>}</tr></thead><tbody className="divide-y">{summary.classrooms.map(x=><tr key={x.classroomId}><td className="p-2 font-medium">{x.classroom}</td>{a&&<td className="p-2">{x.apafaUnpaid} familias</td>}{t&&<td className="p-2">{x.tallerUnpaid} estudiantes</td>}</tr>)}</tbody></table>{!summary.classrooms.length&&<p className="p-4 text-sm text-slate-500">Sin datos para los filtros seleccionados.</p>}</div></Card>
    <Card title="Distribución de pagos"><div className="flex flex-wrap justify-around gap-6">{a&&<Donut label="APAFA" paid={summary.apafa.paid} unpaid={summary.apafa.unpaid} percentage={summary.apafa.paidPercentage}/>} {t&&<Donut label="Taller" paid={summary.taller.paid} unpaid={summary.taller.unpaid} percentage={summary.taller.paidPercentage}/>}</div></Card></div>
}
function Card({title,children}:{title:string;children:ReactNode}){return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</article>}
function Metric({label,value,note}:{label:string;value:string|number;note:string}){return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p><p className="text-xs text-slate-500">{note}</p></div>}
function Progress({label,paid,total,percentage,unit}:{label:string;paid:number;total:number;percentage:number;unit:string}){return <div><div className="mb-2 flex items-end justify-between"><div><p className="font-semibold">{label}</p><p className="text-sm text-slate-500">{paid} / {total} {unit}</p></div><strong className="text-red-800">{percentage}%</strong></div><div className="h-3 rounded-full bg-slate-200"><div className="h-full rounded-full bg-red-800" style={{width:`${Math.min(100,percentage)}%`}}/></div></div>}
function Donut({label,paid,unpaid,percentage}:{label:string;paid:number;unpaid:number;percentage:number}){return <div className="flex items-center gap-4"><div className="grid h-24 w-24 place-items-center rounded-full" style={{background:`conic-gradient(#15803d ${percentage}%, #f59e0b 0)`}}><div className="grid h-16 w-16 place-items-center rounded-full bg-white text-sm font-bold">{percentage}%</div></div><div><p className="font-semibold">{label}</p><p className="text-sm text-emerald-700">● Pagado: {paid}</p><p className="text-sm text-amber-700">● Pendiente: {unpaid}</p></div></div>}

function ExportView({report,paymentType,exporting,onExport,page,setPage}:{report:PaymentsReportResponse;paymentType:PaymentType;exporting:boolean;onExport(f:'xlsx'|'pdf'):void;page:number;setPage(v:number):void}){
  const a=paymentType!=='TALLER',t=paymentType!=='APAFA';
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Estudiantes" value={report.statistics.visibleStudents} note="considerados"/>{a&&<><Metric label="APAFA PAGO" value={report.statistics.apafaPaid} note="familias"/><Metric label="APAFA DEBE" value={report.statistics.apafaUnpaid} note="familias"/></>}{t&&<><Metric label="Taller PAGO" value={report.statistics.tallerPaid} note="estudiantes"/><Metric label="Taller DEBE" value={report.statistics.tallerUnpaid} note="estudiantes"/></>}</div>
    <div className="flex justify-end gap-2"><button disabled={exporting} onClick={()=>onExport('xlsx')} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Exportar Excel</button><button disabled={exporting} onClick={()=>onExport('pdf')} className="rounded-md bg-red-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Exportar PDF</button></div>
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-100"><tr><th className="p-3">Estudiante</th><th className="p-3">Ciclo/Nivel</th><th className="p-3">Aula</th><th className="p-3">Turno</th>{a&&<><th className="p-3">APAFA</th><th className="p-3">Fecha APAFA</th></>}{t&&<><th className="p-3">Taller</th><th className="p-3">Fecha Taller</th></>}</tr></thead><tbody className="divide-y">{report.data.map(row=><tr key={row.enrollmentId}><td className="p-3 font-medium">{row.student.fullName}</td><td className="p-3">{row.academic.cycleName} / {row.academic.educationLevelName}</td><td className="p-3">{row.academic.classroomName}</td><td className="p-3">{row.academic.shiftName}</td>{a&&<><td className="p-3"><Badge value={row.apafa.status}/></td><td className="p-3">{formatDate(row.apafa.paymentDate)}</td></>}{t&&<><td className="p-3"><Badge value={row.taller.status}/></td><td className="p-3">{formatDate(row.taller.paymentDate)}</td></>}</tr>)}</tbody></table>{!report.data.length&&<p className="p-6 text-center text-sm text-slate-500">No se encontraron estudiantes.</p>}</div>
    <div className="flex justify-between text-sm text-slate-600"><span>{report.pagination.total} registros</span><div className="flex gap-2"><button disabled={page<=1} onClick={()=>setPage(page-1)} className="rounded border px-3 py-1 disabled:opacity-40">Anterior</button><span>Página {page} de {Math.max(1,report.pagination.totalPages)}</span><button disabled={page>=report.pagination.totalPages} onClick={()=>setPage(page+1)} className="rounded border px-3 py-1 disabled:opacity-40">Siguiente</button></div></div></div>
}
function Badge({value}:{value:'PAGADO'|'NO_PAGADO'}){return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${value==='PAGADO'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{value==='PAGADO'?'PAGO':'DEBE'}</span>}
function formatDate(value:string|null){if(!value)return '—';const [y,m,d]=value.split('-');return y&&m&&d?`${d}/${m}/${y}`:value}
