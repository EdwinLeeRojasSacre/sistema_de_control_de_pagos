import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service.js';

export interface SetupAdminInput {
  firstName: string;
  lastNameFather: string;
  lastNameMother?: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone?: string;
  username: string;
  password: string;
}

export interface SetupAdminResult {
  id: string;
  personId: string;
  username: string;
  role: 'ADMINISTRADOR';
}

@Injectable()
export class SetupAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createFirstAdministrator(input: SetupAdminInput): Promise<SetupAdminResult> {
    const data = this.normalizeAndValidate(input);

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const activeAdministrator = await transaction.users.findFirst({
            where: {
              is_active: true,
              persons: { is_active: true },
              roles: { code: 'ADMINISTRADOR', is_active: true },
            },
            select: { id: true },
          });

          if (activeAdministrator) {
            throw new ConflictException(
              'Ya existe un ADMINISTRADOR activo. No se realizaron cambios.',
            );
          }

          const role = await transaction.roles.findUnique({
            where: { code: 'ADMINISTRADOR' },
            select: { id: true, is_active: true },
          });
          if (!role?.is_active) {
            throw new ConflictException('El rol ADMINISTRADOR no está disponible.');
          }

          const [existingUsername, existingPerson] = await Promise.all([
            transaction.users.findUnique({
              where: { username: data.username },
              select: { id: true },
            }),
            transaction.persons.findUnique({
              where: {
                document_type_document_number: {
                  document_type: data.documentType,
                  document_number: data.documentNumber,
                },
              },
              select: { id: true },
            }),
          ]);

          if (existingUsername) {
            throw new ConflictException('El username ya está en uso.');
          }
          if (existingPerson) {
            throw new ConflictException(
              'Ya existe una persona con ese tipo y número de documento.',
            );
          }

          const person = await transaction.persons.create({
            data: {
              document_type: data.documentType,
              document_number: data.documentNumber,
              first_name: data.firstName,
              last_name_father: data.lastNameFather,
              last_name_mother: data.lastNameMother,
              email: data.email,
              phone: data.phone,
              is_active: true,
            },
            select: { id: true },
          });

          const passwordHash = await bcrypt.hash(data.password, 12);
          const user = await transaction.users.create({
            data: {
              person_id: person.id,
              role_id: role.id,
              username: data.username,
              password_hash: passwordHash,
              must_change_password: false,
              password_changed_at: new Date(),
              is_active: true,
            },
            select: { id: true, person_id: true, username: true },
          });

          await transaction.audit_logs.create({
            data: {
              user_id: null,
              entity_name: 'users',
              entity_id: user.id,
              action: 'SYSTEM_ADMIN_BOOTSTRAP',
              old_value: Prisma.DbNull,
              new_value: {
                username: user.username,
                role: 'ADMINISTRADOR',
                personId: user.person_id,
                isActive: true,
                bootstrap: true,
              },
              ip_address: null,
              device_name: 'local-installation-bootstrap',
            },
          });

          return {
            id: user.id,
            personId: user.person_id,
            username: user.username,
            role: 'ADMINISTRADOR' as const,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'El documento, username o persona ya se encuentra registrado.',
        );
      }
      throw error;
    }
  }

  private normalizeAndValidate(input: SetupAdminInput) {
    const data = {
      firstName: input.firstName.trim(),
      lastNameFather: input.lastNameFather.trim(),
      lastNameMother: input.lastNameMother?.trim() || null,
      documentType: input.documentType.trim().toUpperCase(),
      documentNumber: input.documentNumber.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      username: input.username.trim().toLowerCase(),
      password: input.password,
    };

    if (!data.firstName || data.firstName.length > 150) {
      throw new BadRequestException('Los nombres son obligatorios y admiten hasta 150 caracteres.');
    }
    if (!data.lastNameFather || data.lastNameFather.length > 150) {
      throw new BadRequestException('El apellido paterno es obligatorio y admite hasta 150 caracteres.');
    }
    if (data.lastNameMother && data.lastNameMother.length > 150) {
      throw new BadRequestException('El apellido materno admite hasta 150 caracteres.');
    }
    if (!data.documentType || data.documentType.length > 20) {
      throw new BadRequestException('El tipo de documento es obligatorio y admite hasta 20 caracteres.');
    }
    if (!data.documentNumber || data.documentNumber.length > 20) {
      throw new BadRequestException('El documento es obligatorio y admite hasta 20 caracteres.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 200) {
      throw new BadRequestException('El correo no tiene un formato válido.');
    }
    if (data.phone && data.phone.length > 30) {
      throw new BadRequestException('El teléfono admite hasta 30 caracteres.');
    }
    if (!/^[a-zA-Z0-9._-]{3,100}$/.test(data.username)) {
      throw new BadRequestException('El username debe tener entre 3 y 100 caracteres permitidos.');
    }
    if (
      data.password.length < 10 ||
      data.password.length > 200 ||
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(data.password)
    ) {
      throw new BadRequestException(
        'La contraseña debe tener entre 10 y 200 caracteres e incluir mayúscula, minúscula y número.',
      );
    }

    return data;
  }
}
