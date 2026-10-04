import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service.js';

interface AuditContext { userId: string; ipAddress: string | null; deviceName: string | null }

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    username: string,
    password: string,
  ) {
    const identifier = username.trim();
    let user =
      await this.prisma.users.findUnique({
        where: {
          username: identifier,
        },
        include: {
          roles: true,
          persons: true,
        },
      });

    if (!user) {
      const emailMatches = await this.prisma.users.findMany({
        where: {
          persons: { email: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
        },
        include: {
          roles: true,
          persons: true,
        },
        take: 2,
      });
      if (emailMatches.length === 1) user = emailMatches[0];
      if (emailMatches.length > 1) {
        this.logger.warn('Login rechazado: identificador por correo ambiguo');
      }
    }

    if (!user) {
      throw new UnauthorizedException(
        'Usuario o contraseña incorrectos',
      );
    }

    const passwordValid =
      await bcrypt.compare(
        password,
        user.password_hash,
      );

    if (
      !passwordValid ||
      !user.is_active ||
      !user.persons.is_active ||
      !user.roles.is_active
    ) {
      throw new UnauthorizedException(
        'Usuario o contraseña incorrectos',
      );
    }

    await this.prisma.users.update({
      where: {
        id: user.id,
      },
      data: {
        last_login: new Date(),
      },
    });
    
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.roles.code,
    };

    return {
      access_token:
        await this.jwtService.signAsync(
          payload,
        ),
      user: {
        id: user.id,
        username: user.username,
        role: user.roles.code,
        name:
          user.persons.first_name +
          ' ' +
          user.persons.last_name_father,
        mustChangePassword: user.must_change_password,
      },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, context: AuditContext) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, password_hash: true, must_change_password: true },
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }
    if (await bcrypt.compare(newPassword, user.password_hash)) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const changedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.users.update({
        where: { id: userId },
        data: { password_hash: passwordHash, must_change_password: false, password_changed_at: changedAt },
      });

      await transaction.audit_logs.create({ data: {
        user_id: context.userId, entity_name: 'users', entity_id: userId,
        action: 'USER_PASSWORD_CHANGE',
        old_value: { mustChangePassword: user.must_change_password },
        new_value: { mustChangePassword: false, passwordChangedAt: changedAt.toISOString() },
        ip_address: context.ipAddress, device_name: context.deviceName,
      } });
    });
    return { mustChangePassword: false, passwordChangedAt: changedAt };
  }
}
