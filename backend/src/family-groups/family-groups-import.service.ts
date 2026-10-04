import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FAMILY_RELATIONSHIP_TYPES, type FamilyRelationshipType } from './dto/create-family-adult.dto.js';
import { FamilyGroupsService, type ImportFamilyCreateInput } from './family-groups.service.js';
import { FAMILY_HEADERS, parseImportFile, type ImportFile, type ParsedImportRow } from '../imports/import-file.js';

type State = 'VALIDO' | 'ADVERTENCIA' | 'ERROR';
type Values = Record<string, string>;
interface FamilyImportGroup {
  fila: number;
  filas: number[];
  familia_referencia: string;
  apoderado: string;
  padre: string;
  madre: string;
  estudiantes: number;
  studentNames: string[];
  estado: State;
  detalle: string;
  codigo_familia?: string;
  student_code?: string;
  dto?: ImportFamilyCreateInput;
  reusedPersons?: number;
}

const documentKey = (type: string, number: string) => `${type.trim().toUpperCase()}:${number.trim()}`;
const fullName = (values: Values, prefix: string) => [
  values[`${prefix}_nombres`], values[`${prefix}_apellido_paterno`], values[`${prefix}_apellido_materno`],
].filter(Boolean).join(' ');
const dateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
};
const age = (birth: Date, today: Date) =>
  today.getUTCFullYear() - birth.getUTCFullYear()
  - (today.getUTCMonth() < birth.getUTCMonth()
    || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate()) ? 1 : 0);

@Injectable()
export class FamilyGroupsImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly families: FamilyGroupsService,
  ) {}

  async preview(file: ImportFile) {
    const parsed = await parseImportFile(file, FAMILY_HEADERS);
    const groups = await this.validateGroups(parsed);
    return { rows: groups.map(this.publicGroup), summary: this.summary(groups, parsed.length) };
  }

  async confirm(file: ImportFile, context: { userId: string; ipAddress: string | null; deviceName: string | null }) {
    const parsed = await parseImportFile(file, FAMILY_HEADERS);
    const groups = await this.validateGroups(parsed);
    for (const group of groups) {
      if (group.estado === 'ERROR' || !group.dto) continue;
      try {
        const result = await this.families.createForImport(group.dto, context);
        group.codigo_familia = result.code ?? '';
        group.detalle = result.code ? 'Familia registrada' : 'Familia registrada sin código';
      } catch (error) {
        group.estado = 'ERROR';
        group.detalle = error instanceof HttpException ? error.message : 'No se pudo registrar la familia';
      }
    }
    await this.prisma.audit_logs.create({
      data: {
        user_id: context.userId, entity_name: 'family_imports', action: 'IMPORT_FAMILIES',
        new_value: {
          rows: parsed.length, familiesProcessed: groups.length,
          created: groups.filter((group) => Boolean(group.codigo_familia)).length,
          reusedPersons: groups.filter((group) => Boolean(group.codigo_familia))
            .reduce((sum, group) => sum + (group.reusedPersons ?? 0), 0),
          errors: groups.filter((group) => group.estado === 'ERROR').length,
        },
        ip_address: context.ipAddress, device_name: context.deviceName,
      },
    });
    return { rows: groups.map(this.publicGroup), summary: this.summary(groups, parsed.length) };
  }

  private publicGroup(group: FamilyImportGroup) {
    const { dto: _dto, reusedPersons: _reusedPersons, ...publicValues } = group;
    return publicValues;
  }

  private summary(groups: FamilyImportGroup[], rowCount: number) {
    return {
      processed: groups.length,
      rows: rowCount,
      valid: groups.filter((group) => group.estado !== 'ERROR').length,
      created: groups.filter((group) => Boolean(group.codigo_familia)).length,
      reused: groups.filter((group) => Boolean(group.codigo_familia))
        .reduce((sum, group) => sum + (group.reusedPersons ?? 0), 0),
      rejected: groups.filter((group) => group.estado === 'ERROR').length,
      students: groups.filter((group) => group.estado !== 'ERROR')
        .reduce((sum, group) => sum + group.estudiantes, 0),
    };
  }

  private async validateGroups(parsed: ParsedImportRow[]): Promise<FamilyImportGroup[]> {
    const period = await this.prisma.school_periods.findFirst({
      where: { status: 'OPEN', is_active: true },
      select: { id: true },
    });
    if (!period) throw new BadRequestException('Debe existir un período escolar abierto para generar códigos de familia.');
    const byReference = new Map<string, ParsedImportRow[]>();
    for (const row of parsed) {
      const reference = row.values.familia_referencia.trim();
      const key = reference || `__SIN_REFERENCIA_${row.rowNumber}`;
      const group = byReference.get(key) ?? [];
      group.push(row);
      byReference.set(key, group);
    }
    const studentReferences = new Map<string, Set<string>>();
    for (const [reference, rows] of byReference) {
      for (const row of rows) {
        const key = documentKey(row.values.estudiante_tipo_documento, row.values.estudiante_numero_documento);
        if (key === ':') continue;
        const references = studentReferences.get(key) ?? new Set<string>();
        references.add(reference);
        studentReferences.set(key, references);
      }
    }
    const pairs = parsed.flatMap((row) => ['estudiante', 'padre', 'madre', 'apoderado']
      .map((prefix) => ({
        document_type: row.values[`${prefix}_tipo_documento`]?.trim().toUpperCase(),
        document_number: row.values[`${prefix}_numero_documento`]?.trim(),
      }))).filter((pair) => pair.document_type && pair.document_number);
    const persons = await this.prisma.persons.findMany({ where: { OR: pairs }, include: { students: true } });
    const personMap = new Map(persons.map((person) => [documentKey(person.document_type, person.document_number ?? ''), person]));
    const memberships = await this.prisma.family_members.findMany({
      where: { person_id: { in: persons.map((person) => person.id) } },
      select: {
        person_id: true,
        relationship_type: true,
        family_groups: { select: { id: true, code: true, is_active: true } },
      },
    });
    const membershipsByPerson = new Map<string, typeof memberships>();
    for (const membership of memberships) {
      const current = membershipsByPerson.get(membership.person_id) ?? [];
      current.push(membership);
      membershipsByPerson.set(membership.person_id, current);
    }
    const today = new Date();
    return [...byReference].map(([reference, rows]) => {
      const first = rows[0].values;
      const errors: string[] = [];
      const warnings: string[] = [];
      if (!first.familia_referencia.trim()) errors.push('Falta familia_referencia.');
      const adultFields = FAMILY_HEADERS.filter((header) => /^(padre|madre|apoderado)_/.test(header));
      if (rows.some((row) => adultFields.some((field) => row.values[field].trim() !== first[field].trim()))) {
        errors.push('Los datos familiares no son coherentes dentro de la misma familia_referencia.');
      }
      const students = rows.map((row) => ({
        documentType: row.values.estudiante_tipo_documento.trim().toUpperCase(),
        documentNumber: row.values.estudiante_numero_documento.trim(),
        firstName: row.values.estudiante_nombres.trim(),
        lastNameFather: row.values.estudiante_apellido_paterno.trim(),
        lastNameMother: row.values.estudiante_apellido_materno.trim(),
        birthDate: row.values.estudiante_fecha_nacimiento.trim(),
      }));
      const seenStudents = new Set<string>();
      for (const student of students) {
        const key = documentKey(student.documentType, student.documentNumber);
        if (Object.values(student).some((value) => !value)) errors.push('Todos los datos del estudiante son obligatorios.');
        if (student.documentType.length > 20 || student.documentNumber.length > 20
          || student.firstName.length > 150 || student.lastNameFather.length > 150
          || student.lastNameMother.length > 150) errors.push('Los datos del estudiante exceden la longitud permitida.');
        if (seenStudents.has(key)) errors.push(`El estudiante ${student.documentNumber} está repetido en la familia.`);
        seenStudents.add(key);
        if ((studentReferences.get(key)?.size ?? 0) > 1) errors.push(`El estudiante ${student.documentNumber} figura en dos familias del archivo.`);
        const birth = dateOnly(student.birthDate);
        if (!birth || birth > today) errors.push(`La fecha de nacimiento del estudiante ${student.documentNumber} es inválida o futura.`);
        const existing = personMap.get(key);
        if (existing) {
          if (!existing.is_active || existing.students?.is_active === false) errors.push(`El estudiante ${student.documentNumber} está inactivo.`);
          const studentFamilies = (membershipsByPerson.get(existing.id) ?? [])
            .filter((membership) => membership.relationship_type === 'ESTUDIANTE');
          if (studentFamilies.length) {
            const codes = [...new Set(studentFamilies.map((membership) => membership.family_groups.code).filter(Boolean))];
            errors.push(`El estudiante ${student.documentNumber} ya pertenece a una familia registrada${codes.length ? ` (${codes.join(', ')})` : ''}. Para modificarla utilice Registro Familiar → Editar.`);
          }
          if (existing.first_name.trim() !== student.firstName || existing.last_name_father?.trim() !== student.lastNameFather
            || existing.last_name_mother?.trim() !== student.lastNameMother
            || (existing.birth_date && existing.birth_date.toISOString().slice(0, 10) !== student.birthDate)) {
            errors.push(`Los datos del estudiante ${student.documentNumber} no coinciden con la persona existente.`);
          } else warnings.push(`Se reutilizará la persona del estudiante ${student.documentNumber}.`);
        }
      }
      const adults: ImportFamilyCreateInput['adults'] = [];
      for (const prefix of ['padre', 'madre', 'apoderado'] as const) {
        const type = first[`${prefix}_tipo_documento`].trim().toUpperCase();
        const number = first[`${prefix}_numero_documento`].trim();
        const hasAny = FAMILY_HEADERS.filter((header) => header.startsWith(`${prefix}_`))
          .some((header) => first[header].trim());
        if (prefix !== 'apoderado' && !hasAny) continue;
        const relation = prefix === 'apoderado' ? first.apoderado_relacion.trim().toUpperCase() : prefix.toUpperCase();
        if (!type || !number || !first[`${prefix}_nombres`].trim()) errors.push(`Faltan datos obligatorios de ${prefix}.`);
        if (type.length > 20 || number.length > 20 || first[`${prefix}_nombres`].trim().length > 150
          || first[`${prefix}_apellido_paterno`].trim().length > 150
          || first[`${prefix}_apellido_materno`].trim().length > 150
          || first[`${prefix}_telefono`]?.trim().length > 30
          || first[`${prefix}_correo`]?.trim().length > 200) {
          errors.push(`Los datos de ${prefix} exceden la longitud permitida.`);
        }
        const email = first[`${prefix}_correo`]?.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`El correo de ${prefix} no es válido.`);
        if (prefix === 'apoderado' && !FAMILY_RELATIONSHIP_TYPES.includes(relation as FamilyRelationshipType)) {
          errors.push(`La relación del apoderado '${relation}' no está permitida.`);
        }
        const birthText = first[`${prefix}_fecha_nacimiento`].trim();
        const birth = birthText ? dateOnly(birthText) : null;
        if (birthText && (!birth || birth > today)) errors.push(`La fecha de nacimiento de ${prefix} es inválida o futura.`);
        if (prefix === 'apoderado' && (!birth || age(birth, today) < 18)) errors.push('El apoderado debe tener al menos 18 años.');
        const key = documentKey(type, number);
        const existingAdult = adults.find((adult) => documentKey(adult.documentType, adult.documentNumber) === key);
        if (existingAdult) {
          if (prefix === 'apoderado' && existingAdult.relationshipType === relation) {
            if (existingAdult.firstName !== first[`${prefix}_nombres`].trim()
              || existingAdult.lastNameFather !== first[`${prefix}_apellido_paterno`].trim()
              || existingAdult.lastNameMother !== first[`${prefix}_apellido_materno`].trim()
              || existingAdult.birthDate !== (birthText || undefined)
              || (existingAdult.phone && first[`${prefix}_telefono`]?.trim()
                && existingAdult.phone !== first[`${prefix}_telefono`].trim())
              || (existingAdult.email && first[`${prefix}_correo`]?.trim()
                && existingAdult.email.toLowerCase() !== first[`${prefix}_correo`].trim().toLowerCase())) {
              errors.push('Los datos del apoderado no coinciden con los del padre o madre.');
            } else existingAdult.isGuardian = true;
          } else errors.push('El mismo adulto tiene relaciones incompatibles dentro de la familia.');
          continue;
        }
        const existing = personMap.get(key);
        if (existing) {
          if (existing.first_name.trim() !== first[`${prefix}_nombres`].trim()
            || (existing.last_name_father && existing.last_name_father.trim() !== first[`${prefix}_apellido_paterno`].trim())
            || (existing.last_name_mother && existing.last_name_mother.trim() !== first[`${prefix}_apellido_materno`].trim())
            || (existing.birth_date && birthText && existing.birth_date.toISOString().slice(0, 10) !== birthText)) {
            errors.push(`Los datos de ${prefix} ${number} no coinciden con la persona existente.`);
          } else warnings.push(`Se reutilizará la persona ${type} ${number}.`);
        }
        adults.push({
          documentType: type, documentNumber: number,
          firstName: first[`${prefix}_nombres`].trim(),
          lastNameFather: first[`${prefix}_apellido_paterno`].trim(),
          lastNameMother: first[`${prefix}_apellido_materno`].trim(),
          birthDate: birthText || undefined,
          phone: first[`${prefix}_telefono`]?.trim() || undefined,
          email: first[`${prefix}_correo`]?.trim() || undefined,
          relationshipType: relation as FamilyRelationshipType,
          isGuardian: prefix === 'apoderado',
        });
      }
      const guardian = adults.find((adult) => adult.isGuardian);
      if (!guardian) errors.push('Debe existir exactamente un apoderado.');
      const studentKeys = new Set(students.map((student) => documentKey(student.documentType, student.documentNumber)));
      if (adults.some((adult) => studentKeys.has(documentKey(adult.documentType, adult.documentNumber)))) {
        errors.push('Una persona no puede ser estudiante y adulto de la misma familia.');
      }
      if (!errors.length) {
        const existingAdultIds = adults
          .map((adult) => personMap.get(documentKey(adult.documentType, adult.documentNumber))?.id)
          .filter((id): id is string => Boolean(id));
        const adultFamilies = new Map<string, { code: string | null }>();
        for (const personId of existingAdultIds) {
          for (const membership of membershipsByPerson.get(personId) ?? []) {
            adultFamilies.set(membership.family_groups.id, { code: membership.family_groups.code });
          }
        }
        if (adultFamilies.size === 1) {
          const family = [...adultFamilies.values()][0];
          errors.push(`Esta familia ya se encuentra registrada en el Sistema de Control de Pagos${family.code ? ` (${family.code})` : ''}. Para modificar sus datos utilice Registro Familiar → Editar.`);
        }
      }
      const names = [...new Set(rows.map((row) => fullName(row.values, 'estudiante')))];
      return {
        fila: rows[0].rowNumber, filas: rows.map((row) => row.rowNumber),
        familia_referencia: first.familia_referencia,
        apoderado: fullName(first, 'apoderado'),
        padre: fullName(first, 'padre'), madre: fullName(first, 'madre'),
        estudiantes: students.length, studentNames: names,
        estado: errors.length ? 'ERROR' : warnings.length ? 'ADVERTENCIA' : 'VALIDO',
        detalle: errors[0] ?? (warnings.join(' ') || 'Familia válida'),
        reusedPersons: warnings.length,
        dto: errors.length ? undefined : { schoolPeriodId: period.id, students, adults },
      };
    });
  }
}
