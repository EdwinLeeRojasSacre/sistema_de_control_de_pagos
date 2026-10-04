import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { ENROLLMENT_HEADERS, FAMILY_HEADERS, parseImportFile, type ImportFile } from './import-file.js';

function csvFile(text: string, name = 'matriculas.csv'): ImportFile {
  const buffer = Buffer.from(text, 'utf8');
  return { originalname: name, mimetype: 'text/csv', size: buffer.length, buffer };
}

describe('import file parser', () => {
  const header = ENROLLMENT_HEADERS.join(',');
  const sample = '2026,DNI,12345678,Ana Pérez,Ciclo II / 4 años,Ositos,Mañana';

  it('parses UTF-8 CSV with accents', async () => {
    const rows = await parseImportFile(csvFile(`\uFEFF${header}\n${sample}\n`), ENROLLMENT_HEADERS);
    expect(rows).toHaveLength(1);
    expect(rows[0].values.estudiante_nombre_referencia).toBe('Ana Pérez');
    expect(rows[0].values.turno).toBe('Mañana');
  });

  it('parses XLSX DATOS after an INSTRUCCIONES sheet', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('INSTRUCCIONES').addRow(['Instrucciones']);
    const data = workbook.addWorksheet('DATOS');
    data.addRow([...ENROLLMENT_HEADERS]);
    data.addRow(['2026', 'DNI', '12345678', 'Ana Pérez', 'Ciclo II / 4 años', 'Ositos', 'Mañana']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const rows = await parseImportFile({
      originalname: 'matriculas.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.length, buffer,
    }, ENROLLMENT_HEADERS);
    expect(rows[0].values.estudiante_nombre_referencia).toBe('Ana Pérez');
  });

  it.each([
    ['FAMILIAS', FAMILY_HEADERS, ['FAM-01', 'DNI', '12345678', 'Ana']],
    ['MATRICULAS', ENROLLMENT_HEADERS, ['2026', 'DNI', '12345678', 'Ana']],
  ] as const)('reads %s, not the first INSTRUCCIONES sheet', async (sheetName, headers, cells) => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('INSTRUCCIONES').addRow(['No son datos']);
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow([...headers]);
    sheet.addRow([...cells]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const rows = await parseImportFile({
      originalname: `${sheetName}.xlsx`,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.length, buffer,
    }, headers);
    expect(rows).toHaveLength(1);
    expect(rows[0].values[headers[0]]).toBe(cells[0]);
  });

  it('normalizes Excel date cells and accepts a trimmed case-insensitive family sheet', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('INSTRUCCIONES').addRow(['Instrucciones']);
    const sheet = workbook.addWorksheet(' Familias ');
    sheet.addRow([...FAMILY_HEADERS]);
    const cells: unknown[] = Array(FAMILY_HEADERS.length).fill('');
    cells[0] = 'FAM-01';
    cells[FAMILY_HEADERS.indexOf('estudiante_fecha_nacimiento')] = 44927;
    sheet.addRow(cells);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const rows = await parseImportFile({ originalname: 'familias.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: buffer.length, buffer }, FAMILY_HEADERS);
    expect(rows[0].values.estudiante_fecha_nacimiento).toBe('2023-01-01');
  });

  it.each([
    ['familias-valida.xlsx', FAMILY_HEADERS, 4, 'familia_referencia'],
    ['matriculas-valida.xlsx', ENROLLMENT_HEADERS, 4, 'periodo'],
  ] as const)('reads the independently produced binary fixture %s', async (name, headers, count, firstHeader) => {
    const buffer = readFileSync(new URL(`../../test/fixtures/imports/${name}`, import.meta.url));
    const rows = await parseImportFile({
      originalname: name,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.length, buffer,
    }, headers);
    expect(rows).toHaveLength(count);
    expect(rows[0].values[firstHeader]).toBeTruthy();
    expect(rows[0].values.estudiante_numero_documento).toBeTruthy();
    if (name === 'familias-valida.xlsx') {
      expect(rows[0].values.estudiante_nombres).toBeTruthy();
      expect(rows[0].values.estudiante_fecha_nacimiento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('distinguishes unreadable XLSX, missing data sheet, and missing headers', async () => {
    const xlsxFile = (buffer: Buffer): ImportFile => ({ originalname: 'familias.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: buffer.length, buffer });
    await expect(parseImportFile(xlsxFile(Buffer.from('PKnot-a-zip')), FAMILY_HEADERS)).rejects.toThrow('formato válido');
    const missingSheet = new ExcelJS.Workbook();
    missingSheet.addWorksheet('INSTRUCCIONES').addRow(['Instrucciones']);
    await expect(parseImportFile(xlsxFile(Buffer.from(await missingSheet.xlsx.writeBuffer())), FAMILY_HEADERS)).rejects.toThrow('hoja FAMILIAS');
    const missingHeader = new ExcelJS.Workbook();
    missingHeader.addWorksheet('FAMILIAS').addRow(['familia_referencia']);
    missingHeader.getWorksheet('FAMILIAS')?.addRow(['FAM-01']);
    await expect(parseImportFile(xlsxFile(Buffer.from(await missingHeader.xlsx.writeBuffer())), FAMILY_HEADERS)).rejects.toThrow('Faltan columnas');
  });

  it('rejects missing headers, empty files, disallowed types and oversize files', async () => {
    await expect(parseImportFile(csvFile('periodo,aula\n2026,Ositos'), ENROLLMENT_HEADERS)).rejects.toThrow('Faltan columnas');
    await expect(parseImportFile(csvFile(''), ENROLLMENT_HEADERS)).rejects.toThrow('no vacío');
    await expect(parseImportFile(csvFile(`${header}\n${sample}`, 'archivo.pdf'), ENROLLMENT_HEADERS)).rejects.toThrow('Solo se admiten');
    const oversized = csvFile(`${header}\n${sample}`);
    oversized.size = 2 * 1024 * 1024 + 1;
    await expect(parseImportFile(oversized, ENROLLMENT_HEADERS)).rejects.toThrow('2 MB');
  });
});
