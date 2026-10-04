import { api } from '@/lib/axios';

export type ImportKind = 'family-groups' | 'enrollments';
export type ImportState = 'VALIDO' | 'ADVERTENCIA' | 'ERROR';

export interface ImportRow {
  fila: number;
  filas?: number[];
  familia_referencia: string;
  estado: ImportState;
  detalle: string;
  codigo_familia?: string;
  student_code?: string;
  estudiante?: string;
  documento?: string;
  periodo?: string;
  ciclo_nivel?: string;
  aula?: string;
  turno?: string;
  apoderado?: string;
  estudiantes?: number;
  padre?: string;
  madre?: string;
  studentNames?: string[];
}

export interface ImportResult {
  rows: ImportRow[];
  summary: {
    processed: number;
    valid: number;
    created: number;
    rejected: number;
    reused?: number;
    students?: number;
  };
}

export async function validateImport(kind: ImportKind, file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  return (await api.post<ImportResult>(`/${kind}/import/preview`, form)).data;
}

export async function confirmImport(kind: ImportKind, file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  return (await api.post<ImportResult>(`/${kind}/import/confirm`, form)).data;
}

export async function downloadImportTemplate(kind: ImportKind): Promise<void> {
  const response = await api.get<Blob>(`/${kind}/import/template`, { responseType: 'blob' });
  download(response.data, `SGPE_Plantilla_${kind === 'enrollments' ? 'Matriculas' : 'Familias'}.xlsx`);
}

export function downloadImportResult(rows: ImportRow[], kind: ImportKind): void {
  const headers = ['fila', 'familia_referencia', 'estado', 'detalle', 'codigo_familia', 'student_code'];
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const content = '\uFEFF' + [
    headers.join(','),
    ...rows.flatMap((row) => (row.filas?.length ? row.filas : [row.fila]).map((fila) =>
      headers.map((header) => escape(header === 'fila' ? fila : row[header as keyof ImportRow])).join(','))),
  ].join('\r\n');
  download(new Blob([content], { type: 'text/csv;charset=utf-8' }), `resultado-${kind}.csv`);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
