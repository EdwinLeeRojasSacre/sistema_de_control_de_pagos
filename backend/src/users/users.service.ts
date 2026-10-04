import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SYSTEM_VERSION } from '../system-version.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { PublicSupportResponseDto } from './dto/public-support-response.dto.js';
import type { UpdateMyProfileDto } from './dto/update-my-profile.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

interface AuditContext { userId: string; ipAddress: string | null; deviceName: string | null }

const userSelect = {
  id: true, person_id: true, username: true, is_active: true,
  must_change_password: true, password_changed_at: true, last_login: true,
  created_at: true, updated_at: true,
  persons: { select: { id: true, first_name: true, last_name_father: true, last_name_mother: true, document_type: true, document_number: true, birth_date: true, gender: true, phone: true, email: true, address: true, is_active: true } },
  roles: { select: { code: true, name: true } },
} satisfies Prisma.usersSelect;
type SelectedUser = Prisma.usersGetPayload<{ select: typeof userSelect }>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(actor: AuthenticatedUser) {
    const user = await this.prisma.users.findUnique({ where: { id: actor.sub }, select: userSelect });
    if (!user) throw new NotFoundException('Perfil no encontrado');
    return this.toMyProfileResponse(user);
  }

  async updateMyProfile(actor: AuthenticatedUser, dto: UpdateMyProfileDto, context: AuditContext) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('Debe indicar al menos un dato para actualizar');
    }
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.users.findUnique({ where: { id: actor.sub }, select: userSelect });
      if (!current) throw new NotFoundException('Perfil no encontrado');
      if (!current.persons.is_active) throw new ConflictException('La persona esta inactiva');

      await transaction.persons.update({
        where: { id: current.person_id },
        data: {
          ...(dto.documentType !== undefined ? { document_type: dto.documentType.trim().toUpperCase() } : {}),
          ...(dto.documentNumber !== undefined ? { document_number: dto.documentNumber.trim() } : {}),
          ...(dto.firstName !== undefined ? { first_name: dto.firstName.trim() } : {}),
          ...(dto.lastNameFather !== undefined ? { last_name_father: this.optionalText(dto.lastNameFather) } : {}),
          ...(dto.lastNameMother !== undefined ? { last_name_mother: this.optionalText(dto.lastNameMother) } : {}),
          ...(dto.gender !== undefined ? { gender: this.optionalText(dto.gender)?.toUpperCase() } : {}),
          ...(dto.phone !== undefined ? { phone: this.optionalText(dto.phone) } : {}),
          ...(dto.email !== undefined ? { email: this.optionalText(dto.email)?.toLowerCase() } : {}),
        },
      });
      const updated = await transaction.users.findUnique({ where: { id: actor.sub }, select: userSelect });
      if (!updated) throw new NotFoundException('Perfil no encontrado');
      await this.audit(
        transaction,
        actor.sub,
        'USER_UPDATE',
        this.profileSnapshot(current),
        this.profileSnapshot(updated),
        context,
      );
      return this.toMyProfileResponse(updated);
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe otra persona con ese tipo y numero de documento');
      }
      throw error;
    });
  }

  async getPublicSupport(): Promise<PublicSupportResponseDto> {
    const administrators = await this.prisma.users.findMany({
      where: {
        is_active: true,
        persons: { is_active: true },
        roles: { code: 'ADMINISTRADOR', is_active: true },
      },
      select: {
        persons: {
          select: {
            first_name: true,
            last_name_father: true,
            last_name_mother: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
      take: 2,
    });

    if (administrators.length > 1) {
      this.logger.warn('Se detectaron multiples cuentas ADMINISTRADOR activas; se omite el contacto publico');
    }
    const administrator = administrators.length === 1 ? administrators[0] : null;
    const administratorName = administrator
      ? [
          administrator.persons.first_name,
          administrator.persons.last_name_father,
          administrator.persons.last_name_mother,
        ].filter(Boolean).join(' ')
      : null;

    return {
      institution: 'I.E.I. Cuna Jardín N.° 85 “María Inmaculada Concepción” — Chancay',
      administratorName,
      administratorEmail: administrator?.persons.email ?? null,
      administratorPhone: administrator?.persons.phone ?? null,
      version: SYSTEM_VERSION,
    };
  }

  async findAll(actor: AuthenticatedUser) {
    const users = await this.prisma.users.findMany({
      where: this.scope(actor), select: userSelect,
      orderBy: [{ persons: { last_name_father: 'asc' } }, { username: 'asc' }],
    });
    return users.map((user) => this.toResponse(user));
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const user = await this.prisma.users.findFirst({ where: { id, ...this.scope(actor) }, select: userSelect });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.toResponse(user);
  }

  async getOptions(actor: AuthenticatedUser) {
    const allowedRoles = this.allowedTargetRoles(actor);
    const [persons, roles] = await Promise.all([
      this.prisma.persons.findMany({
        where: { is_active: true, users: null },
        select: { id: true, first_name: true, last_name_father: true, last_name_mother: true, document_type: true, document_number: true },
        orderBy: [{ last_name_father: 'asc' }, { first_name: 'asc' }],
      }),
      this.prisma.roles.findMany({ where: { is_active: true, code: { in: allowedRoles } }, select: { code: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return { persons, roles };
  }

  async findPersonByDocument(documentType: string, documentNumber: string) {
    const person = await this.prisma.persons.findUnique({
      where: { document_type_document_number: {
        document_type: documentType.trim().toUpperCase(),
        document_number: documentNumber.trim(),
      } },
      select: {
        id: true, document_type: true, document_number: true, first_name: true,
        last_name_father: true, last_name_mother: true, birth_date: true,
        gender: true, phone: true, email: true, address: true, is_active: true,
        users: { select: { id: true, username: true, is_active: true } },
      },
    });
    if (!person) return { found: false, person: null };
    return {
      found: true,
      person: {
        id: person.id, documentType: person.document_type,
        documentNumber: person.document_number, firstName: person.first_name,
        lastNameFather: person.last_name_father, lastNameMother: person.last_name_mother,
        birthDate: person.birth_date, gender: person.gender, phone: person.phone,
        email: person.email, address: person.address, isActive: person.is_active,
        hasUser: person.users !== null, user: person.users,
      },
    };
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser, context: AuditContext) {
    this.assertCanManageRole(actor, dto.role);
    if ((!dto.personId && !dto.person) || (dto.personId && dto.person)) {
      throw new BadRequestException('Debe indicar una persona existente o los datos de una nueva persona');
    }
    const username = dto.username.trim().toLowerCase();
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    try {
      const created = await this.runSerializable(async (transaction) => {
        const role = await transaction.roles.findUnique({ where: { code: dto.role }, select: { id: true, code: true, is_active: true } });
        if (!role?.is_active) throw new ConflictException('El rol no esta disponible');
        const isActive = dto.isActive ?? true;
        if (isActive) {
          await this.assertNoOtherActiveRole(transaction, role.code);
        }
        const duplicateUsername = await transaction.users.findUnique({ where: { username }, select: { id: true } });
        if (duplicateUsername) throw new ConflictException('El username ya esta en uso');

        let person: { id: string; is_active: boolean; users: { id: string } | null };
        if (dto.personId) {
          const existing = await transaction.persons.findUnique({ where: { id: dto.personId }, select: { id: true, is_active: true, users: { select: { id: true } } } });
          if (!existing) throw new NotFoundException('Persona no encontrada');
          person = existing;
        } else {
          const data = dto.person!;
          const createdPerson = await transaction.persons.create({ data: {
            document_type: data.documentType.trim().toUpperCase(),
            document_number: data.documentNumber.trim(),
            first_name: data.firstName.trim(),
            last_name_father: this.optionalText(data.lastNameFather),
            last_name_mother: this.optionalText(data.lastNameMother),
            birth_date: data.birthDate ? new Date(data.birthDate) : null,
            gender: this.optionalText(data.gender)?.toUpperCase(),
            phone: this.optionalText(data.phone), email: this.optionalText(data.email)?.toLowerCase(),
            address: this.optionalText(data.address),
          }, select: { id: true, is_active: true } });
          person = { ...createdPerson, users: null };
        }
        if (!person.is_active) throw new ConflictException('La persona esta inactiva');
        if (person.users) throw new ConflictException('La persona ya tiene una cuenta');
        const user = await transaction.users.create({
          data: { person_id: person.id, role_id: role.id, username, password_hash: passwordHash, must_change_password: true, is_active: isActive },
          select: userSelect,
        });
        await this.audit(transaction, user.id, 'USER_CREATE', null, { username: user.username, role: user.roles.code, personId: user.person_id, isActive: user.is_active, mustChangePassword: true }, context);
        return user;
      });
      return { user: this.toResponse(created), temporaryPassword };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(' ') : String(error.meta?.target ?? '');
        if (target.includes('document')) throw new ConflictException('Ya existe una persona con ese tipo y numero de documento');
        if (target.includes('username')) throw new ConflictException('El username ya esta en uso');
        if (target.includes('person_id')) throw new ConflictException('Esta persona ya tiene una cuenta de usuario');
        throw new ConflictException('El documento, username o persona ya se encuentra registrado');
      }
      throw error;
    }
  }

  async updateStatus(id: string, isActive: boolean, actor: AuthenticatedUser, context: AuditContext) {
    if (id === actor.sub && !isActive) throw new ConflictException('No puede desactivar su propia cuenta');
    return this.runSerializable(async (transaction) => {
      const target = await this.getManageableTarget(transaction, id, actor);
      if (target.is_active === isActive) return this.toResponse(target);
      if (isActive) {
        await this.assertNoOtherActiveRole(transaction, target.roles.code, id);
      }
      const updated = await transaction.users.update({ where: { id }, data: { is_active: isActive }, select: userSelect });
      await this.audit(transaction, id, isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', { isActive: target.is_active }, { isActive }, context);
      return this.toResponse(updated);
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser, context: AuditContext) {
    if ('personId' in dto || 'role' in dto) {
      throw new BadRequestException('No se permite cambiar la persona ni el rol de una cuenta');
    }
    if (dto.username === undefined && dto.person === undefined) {
      throw new BadRequestException('Debe indicar al menos un dato para actualizar');
    }
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const target = await this.getManageableTarget(transaction, id, actor);
        if (!target.persons.is_active) throw new ConflictException('La persona esta inactiva');
        const username = dto.username?.trim().toLowerCase();
        if (username && username !== target.username) {
          const duplicate = await transaction.users.findUnique({ where: { username }, select: { id: true } });
          if (duplicate) throw new ConflictException('El username ya esta en uso');
        }

        if (dto.person) {
          const data = dto.person;
          await transaction.persons.update({
            where: { id: target.person_id },
            data: {
              ...(data.documentType !== undefined ? { document_type: data.documentType.trim().toUpperCase() } : {}),
              ...(data.documentNumber !== undefined ? { document_number: data.documentNumber.trim() } : {}),
              ...(data.firstName !== undefined ? { first_name: data.firstName.trim() } : {}),
              ...(data.lastNameFather !== undefined ? { last_name_father: this.optionalText(data.lastNameFather) } : {}),
              ...(data.lastNameMother !== undefined ? { last_name_mother: this.optionalText(data.lastNameMother) } : {}),
              ...(data.birthDate !== undefined ? { birth_date: data.birthDate ? new Date(data.birthDate) : null } : {}),
              ...(data.gender !== undefined ? { gender: this.optionalText(data.gender)?.toUpperCase() } : {}),
              ...(data.phone !== undefined ? { phone: this.optionalText(data.phone) } : {}),
              ...(data.email !== undefined ? { email: this.optionalText(data.email)?.toLowerCase() } : {}),
              ...(data.address !== undefined ? { address: this.optionalText(data.address) } : {}),
            },
          });
        }
        const updated = username && username !== target.username
          ? await transaction.users.update({ where: { id }, data: { username }, select: userSelect })
          : await transaction.users.findUnique({ where: { id }, select: userSelect });
        if (!updated) throw new NotFoundException('Usuario no encontrado');
        await this.audit(transaction, id, 'USER_UPDATE', this.editSnapshot(target), this.editSnapshot(updated), context);
        return this.toResponse(updated);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(' ') : String(error.meta?.target ?? '');
        if (target.includes('document')) throw new ConflictException('Ya existe otra persona con ese tipo y numero de documento');
        throw new ConflictException('El username ya esta en uso');
      }
      throw error;
    }
  }

  async resetPassword(id: string, actor: AuthenticatedUser, context: AuditContext) {
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.$transaction(async (transaction) => {
      const target = await this.getManageableTarget(transaction, id, actor);
      if (!target.is_active || !target.persons.is_active) {
        throw new ConflictException('Debe activar el usuario y la persona antes de restablecer la contraseña');
      }
      await transaction.users.update({ where: { id }, data: { password_hash: passwordHash, must_change_password: true } });
      await this.audit(transaction, id, 'USER_PASSWORD_RESET', { mustChangePassword: target.must_change_password }, { mustChangePassword: true }, context);
    });
    return { temporaryPassword };
  }

  private scope(actor: AuthenticatedUser): Prisma.usersWhereInput {
    if (actor.role === 'ADMINISTRADOR') return { roles: { code: { in: ['SECRETARIA', 'DIRECCION'] } } };
    if (actor.role === 'SECRETARIA') return { roles: { code: 'DIRECCION' } };
    throw new ForbiddenException('No tiene permisos para administrar usuarios');
  }

  private allowedTargetRoles(actor: AuthenticatedUser) {
    if (actor.role === 'ADMINISTRADOR') return ['SECRETARIA', 'DIRECCION'];
    if (actor.role === 'SECRETARIA') return ['DIRECCION'];
    throw new ForbiddenException('No tiene permisos para administrar usuarios');
  }

  private assertCanManageRole(actor: AuthenticatedUser, targetRole: string) {
    if (!this.allowedTargetRoles(actor).includes(targetRole)) throw new ForbiddenException('No puede administrar usuarios con ese rol');
  }

  private async getManageableTarget(transaction: Prisma.TransactionClient, id: string, actor: AuthenticatedUser) {
    const target = await transaction.users.findUnique({ where: { id }, select: userSelect });
    if (!target) throw new NotFoundException('Usuario no encontrado');
    this.assertCanManageRole(actor, target.roles.code);
    return target;
  }

  private async assertNoOtherActiveRole(transaction: Prisma.TransactionClient, roleCode: string, excludedId?: string) {
    const active = await transaction.users.findFirst({
      where: {
        is_active: true,
        roles: { code: roleCode },
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
      select: { username: true },
    });
    if (active) {
      throw new ConflictException(
        `Ya existe una cuenta ${roleCode} activa: ${active.username}. Desactívela antes de activar otra.`,
      );
    }
  }

  private async runSerializable<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 15000,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 3) continue;
        throw error;
      }
    }
    throw new ConflictException('No se pudo completar la operación debido a concurrencia. Intente nuevamente.');
  }

  private generateTemporaryPassword() { return `Sg${randomBytes(9).toString('base64url')}7!`; }

  private optionalText(value?: string | null) {
    const normalized = value?.trim();
    return normalized || null;
  }

  private async audit(transaction: Prisma.TransactionClient, entityId: string, action: string, oldValue: Prisma.InputJsonObject | null, newValue: Prisma.InputJsonObject, context: AuditContext) {
    await transaction.audit_logs.create({ data: {
      user_id: context.userId, entity_name: 'users', entity_id: entityId, action,
      old_value: oldValue === null ? Prisma.DbNull : oldValue, new_value: newValue,
      ip_address: context.ipAddress, device_name: context.deviceName,
    } });
  }

  private editSnapshot(user: SelectedUser): Prisma.InputJsonObject {
    return {
      username: user.username,
      person: {
        documentType: user.persons.document_type,
        documentNumber: user.persons.document_number,
        firstName: user.persons.first_name,
        lastNameFather: user.persons.last_name_father,
        lastNameMother: user.persons.last_name_mother,
        birthDate: user.persons.birth_date?.toISOString() ?? null,
        gender: user.persons.gender,
        phone: user.persons.phone,
        email: user.persons.email,
        address: user.persons.address,
      },
    };
  }

  private profileSnapshot(user: SelectedUser): Prisma.InputJsonObject {
    return {
      documentType: user.persons.document_type,
      documentNumber: user.persons.document_number,
      firstName: user.persons.first_name,
      lastNameFather: user.persons.last_name_father,
      lastNameMother: user.persons.last_name_mother,
      gender: user.persons.gender,
      phone: user.persons.phone,
      email: user.persons.email,
    };
  }

  private toMyProfileResponse(user: SelectedUser) {
    return {
      username: user.username,
      role: { code: user.roles.code, name: user.roles.name },
      person: {
        firstName: user.persons.first_name,
        lastNameFather: user.persons.last_name_father,
        lastNameMother: user.persons.last_name_mother,
        documentType: user.persons.document_type,
        documentNumber: user.persons.document_number,
        gender: user.persons.gender,
        phone: user.persons.phone,
        email: user.persons.email,
      },
    };
  }

  private toResponse(user: SelectedUser) {
    return {
      id: user.id, personId: user.person_id, username: user.username,
      role: user.roles, person: {
        id: user.persons.id, documentType: user.persons.document_type,
        documentNumber: user.persons.document_number, firstName: user.persons.first_name,
        lastNameFather: user.persons.last_name_father, lastNameMother: user.persons.last_name_mother,
        birthDate: user.persons.birth_date, gender: user.persons.gender,
        phone: user.persons.phone, email: user.persons.email,
        address: user.persons.address, isActive: user.persons.is_active,
      }, isActive: user.is_active,
      mustChangePassword: user.must_change_password,
      passwordChangedAt: user.password_changed_at, lastLogin: user.last_login,
      createdAt: user.created_at, updatedAt: user.updated_at,
    };
  }
}
