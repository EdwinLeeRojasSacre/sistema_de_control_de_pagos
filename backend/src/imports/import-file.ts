import { BadRequestException, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

export const IMPORT_FILE_LIMIT = 2 * 1024 * 1024;
export const IMPORT_ROW_LIMIT = 1000;
const logger = new Logger('ImportFile');

export const FAMILY_HEADERS = [
  'familia_referencia',
  'estudiante_tipo_documento', 'estudiante_numero_documento', 'estudiante_nombres',
  'estudiante_apellido_paterno', 'estudiante_apellido_materno', 'estudiante_fecha_nacimiento',
  'padre_tipo_documento', 'padre_numero_documento', 'padre_nombres',
  'padre_apellido_paterno', 'padre_apellido_materno', 'padre_fecha_nacimiento',
  'padre_telefono', 'padre_correo',
  'madre_tipo_documento', 'madre_numero_documento', 'madre_nombres',
  'madre_apellido_paterno', 'madre_apellido_materno', 'madre_fecha_nacimiento',
  'madre_telefono', 'madre_correo',
  'apoderado_tipo_documento', 'apoderado_numero_documento', 'apoderado_nombres',
  'apoderado_apellido_paterno', 'apoderado_apellido_materno',
  'apoderado_fecha_nacimiento', 'apoderado_telefono', 'apoderado_correo',
  'apoderado_relacion',
] as const;

export const ENROLLMENT_HEADERS = [
  'periodo', 'estudiante_tipo_documento', 'estudiante_numero_documento',
  'estudiante_nombre_referencia', 'ciclo_nivel', 'aula', 'turno',
] as const;

export interface ImportFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ParsedImportRow {
  rowNumber: number;
  values: Record<string, string>;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text);
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

function excelDateText(value: ExcelJS.CellValue): string {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value < 2958466) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  }
  return cellText(value);
}

// ExcelJS 4.4 cannot read some valid OOXML files whose spreadsheet elements
// use an explicit namespace prefix (for example <x:workbook>). Normalize only
// that namespace in memory, leaving relationships and other XML namespaces intact.
async function normalizeSpreadsheetNamespace(buffer: Buffer): Promise<Buffer | null> {
  const zip = await JSZip.loadAsync(buffer);
  const workbookEntry = zip.file('xl/workbook.xml');
  if (!workbookEntry) return null;
  const workbookXml = await workbookEntry.async('string');
  const prefix = /<([A-Za-z_][\w.-]*):workbook\b/.exec(workbookXml)?.[1];
  if (!prefix || !workbookXml.includes(`xmlns:${prefix}="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`)) return null;
  const elementPrefix = new RegExp(`<(/?)${prefix}:`, 'g');
  const namespace = `xmlns:${prefix}="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`;
  for (const name of Object.keys(zip.files)) {
    if (!/^xl\/(?:workbook|styles|sharedStrings|worksheets\/[^/]+)\.xml$/.test(name)) continue;
    const entry = zip.file(name);
    if (!entry) continue;
    const xml = await entry.async('string');
    if (!xml.includes(`<${prefix}:`)) continue;
    zip.file(name, xml.replaceAll(namespace, 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace(elementPrefix, '<$1'));
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '"') {
      if (quoted && content[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value); value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && content[index + 1] === '\n') index += 1;
      row.push(value); value = '';
      rows.push(row); row = [];
    } else {
      value += char;
    }
  }
  if (quoted) throw new BadRequestException('El CSV contiene comillas sin cerrar.');
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

export async function parseImportFile(
  file: ImportFile | undefined,
  expectedHeaders: readonly string[],
): Promise<ParsedImportRow[]> {
  if (!file?.buffer?.length) throw new BadRequestException('Debe seleccionar un archivo no vacío.');
  if (file.size > IMPORT_FILE_LIMIT || file.buffer.length > IMPORT_FILE_LIMIT) {
    throw new BadRequestException('El archivo supera el límite de 2 MB.');
  }
  const extension = file.originalname.toLowerCase().split('.').pop();
  let raw: string[][];
  if (extension === 'csv' && ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream'].includes(file.mimetype)) {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer).replace(/^\uFEFF/, ''); }
    catch { throw new BadRequestException('El CSV debe estar codificado en UTF-8.'); }
    raw = parseCsv(text);
  } else if (extension === 'xlsx' && [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ].includes(file.mimetype)) {
    if (file.buffer.subarray(0, 2).toString() !== 'PK') throw new BadRequestException('El XLSX no es válido.');
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(file.buffer as never); }
    catch (error) {
      try {
        const normalized = await normalizeSpreadsheetNamespace(file.buffer);
        if (!normalized) throw error;
        await workbook.xlsx.load(normalized as never);
      } catch (retryError) {
        const reason = retryError instanceof Error ? `${retryError.name}: ${retryError.message.slice(0, 300)}` : 'Error desconocido';
        logger.warn(`No se pudo abrir XLSX (${reason}).`);
        throw new BadRequestException('El archivo XLSX no tiene un formato válido.');
      }
    }
    const dataSheetName = expectedHeaders === FAMILY_HEADERS ? 'FAMILIAS' : 'MATRICULAS';
    const worksheet = workbook.worksheets.find((sheet) => sheet.name.trim().toUpperCase() === dataSheetName)
      ?? workbook.worksheets.find((sheet) => sheet.name.trim().toUpperCase() === 'DATOS');
    if (!worksheet) throw new BadRequestException(`El archivo debe contener la hoja ${dataSheetName} (o DATOS).`);
    raw = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      raw.push(Array.from({ length: Math.max(row.cellCount, expectedHeaders.length) }, (_, index) => {
        const value = row.getCell(index + 1).value;
        const columnName = worksheet.getRow(1).getCell(index + 1).text.trim();
        return columnName.endsWith('fecha_nacimiento') ? excelDateText(value) : cellText(value);
      }));
    });
  } else {
    throw new BadRequestException('Solo se admiten archivos CSV o XLSX válidos.');
  }
  if (raw.length < 2) throw new BadRequestException('El archivo no contiene filas de datos.');
  const headers = raw[0].map((header) => header.trim().replace(/^\uFEFF/, ''));
  const missing = expectedHeaders.filter((header) => !headers.includes(header));
  if (missing.length) throw new BadRequestException(`Faltan columnas: ${missing.join(', ')}.`);
  const rows = raw.slice(1).map((cells, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(expectedHeaders.map((header) => [header, (cells[headers.indexOf(header)] ?? '').trim()])),
  })).filter((row) => Object.values(row.values).some(Boolean));
  if (!rows.length) throw new BadRequestException('El archivo no contiene filas de datos.');
  if (rows.length > IMPORT_ROW_LIMIT) throw new BadRequestException('El archivo supera el límite de 1000 filas.');
  return rows;
}

export async function createImportTemplate(headers: readonly string[], title: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet('INSTRUCCIONES');
  instructions.addRow([title]);
  instructions.addRow(['Complete una fila por estudiante. No modifique los encabezados de la hoja DATOS.']);
  instructions.addRow(['Guarde el archivo como XLSX o CSV UTF-8 antes de validar.']);
  const data = workbook.addWorksheet('DATOS');
  data.addRow([...headers]);
  data.getRow(1).font = { bold: true };
  data.columns = headers.map((header) => ({ width: Math.max(18, header.length + 2) }));
  data.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function importResultsCsv(rows: Array<Record<string, string | number | null>>): Buffer {
  const headers = ['fila', 'familia_referencia', 'estado', 'detalle', 'codigo_familia', 'student_code'];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return Buffer.from('\uFEFF' + [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\r\n'), 'utf8');
}
