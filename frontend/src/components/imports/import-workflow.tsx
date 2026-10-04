'use client';

import { useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  confirmImport, downloadImportResult, downloadImportTemplate,
  validateImport, type ImportKind, type ImportResult, type ImportRow,
} from '@/services/imports.service';

const MAX_FILE_SIZE = 2 * 1024 * 1024;

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('. ');
  }
  return 'No se pudo procesar el archivo. Revise el formato e intente nuevamente.';
}

export default function ImportWorkflow({ kind }: { kind: ImportKind }) {
  const isFamily = kind === 'family-groups';
  const label = isFamily ? 'familias' : 'matrículas';
  const back = isFamily ? '/dashboard/family-groups' : '/dashboard/enrollments';
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  async function validate() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setPreview(await validateImport(kind, file));
      setResult(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!file || !preview) return;
    setBusy(true);
    setError('');
    try {
      setResult(await confirmImport(kind, file));
      setPreview(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href={back} className="text-sm font-medium text-slate-600 hover:text-red-800">← Volver</Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Importar {label}</h1>
        <p className="mt-1 text-sm text-slate-600">Valide el archivo antes de confirmar. Las filas con errores no se importarán.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void downloadImportTemplate(kind)}
            className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">
            Descargar plantilla Excel
          </button>
          <label className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Seleccionar archivo
            <input className="sr-only" type="file" accept=".xlsx,.csv" onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
              setPreview(null);
              setResult(null);
              setError(selected && selected.size > MAX_FILE_SIZE ? 'El archivo supera el límite de 2 MB.' : '');
            }} />
          </label>
          <span className="text-sm text-slate-600">{file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Ningún archivo seleccionado'}</span>
          <button type="button" disabled={!file || file.size > MAX_FILE_SIZE || busy}
            onClick={() => void validate()}
            className="rounded-md bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-50">
            {busy ? 'Procesando…' : 'Validar archivo'}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">CSV UTF-8 o XLSX · máximo 2 MB y 1000 filas. La vista previa no guarda datos.</p>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {(preview || result) && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{result ? 'Importación completada' : 'Vista previa'}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <p>Procesados: <strong>{(result ?? preview)?.summary.processed}</strong></p>
              <p>Válidos: <strong>{(result ?? preview)?.summary.valid}</strong></p>
              <p>Creados: <strong>{(result ?? preview)?.summary.created}</strong></p>
              <p>Rechazados: <strong>{(result ?? preview)?.summary.rejected}</strong></p>
            </div>
            {isFamily && (result ?? preview)?.summary.students !== undefined && (
              <p className="mt-2 text-sm text-slate-600">Estudiantes: {(result ?? preview)?.summary.students} · Personas reutilizadas: {(result ?? preview)?.summary.reused ?? 0}</p>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  {(isFamily
                    ? ['Fila', 'Referencia', 'Apoderado', 'Estudiantes', 'Estado', 'Detalle']
                    : ['Fila', 'Estudiante', 'Documento', 'Período', 'Ciclo/nivel', 'Aula', 'Turno', 'Estado', 'Detalle']
                  ).map((title) => <th key={title} className="px-3 py-2 font-semibold">{title}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(result ?? preview)?.rows.map((row, index) => <ImportRowView
                  key={`${row.fila}-${index}`} row={row} isFamily={isFamily}
                  expanded={expanded === index} onToggle={() => setExpanded(expanded === index ? null : index)}
                />)}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3">
            {preview && <>
              <button type="button" onClick={() => setPreview(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button>
              <button type="button" disabled={busy || preview.summary.valid === 0} onClick={() => void confirm()}
                className="rounded-md bg-red-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Confirmar importación
              </button>
            </>}
            {result && <button type="button" onClick={() => downloadImportResult(result.rows, kind)}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
              Descargar resultado CSV
            </button>}
          </div>
        </div>
      )}
    </section>
  );
}

function ImportRowView({ row, isFamily, expanded, onToggle }: {
  row: ImportRow; isFamily: boolean; expanded: boolean; onToggle: () => void;
}) {
  const badge = row.estado === 'ERROR'
    ? 'bg-red-100 text-red-700'
    : row.estado === 'ADVERTENCIA' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  return <>
    <tr>
      <td className="px-3 py-2">{row.fila}</td>
      {isFamily ? <>
        <td className="px-3 py-2">{row.familia_referencia}</td>
        <td className="px-3 py-2">{row.apoderado ?? '—'}</td>
        <td className="px-3 py-2">{row.estudiantes ?? 0}</td>
      </> : <>
        <td className="px-3 py-2">{row.estudiante ?? '—'}</td>
        <td className="px-3 py-2">{row.documento ?? '—'}</td>
        <td className="px-3 py-2">{row.periodo ?? '—'}</td>
        <td className="px-3 py-2">{row.ciclo_nivel ?? '—'}</td>
        <td className="px-3 py-2">{row.aula ?? '—'}</td>
        <td className="px-3 py-2">{row.turno ?? '—'}</td>
      </>}
      <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge}`}>{row.estado}</span></td>
      <td className="px-3 py-2">{row.detalle}{isFamily && <button type="button" className="ml-2 text-red-800 underline" onClick={onToggle}>{expanded ? 'Ocultar' : 'Ver detalle'}</button>}</td>
    </tr>
    {isFamily && expanded && <tr><td colSpan={6} className="bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Padre: {row.padre ?? '—'} · Madre: {row.madre ?? '—'} · Estudiantes: {row.studentNames?.join(', ') ?? '—'}
    </td></tr>}
  </>;
}
