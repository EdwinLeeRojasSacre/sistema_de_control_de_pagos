import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../prisma/prisma.service.js';
import { getJwtSecret } from './jwt.config.js';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

export interface AuthenticatedUser {
  sub: string;
  username: string;
  role: string;
  mustChangePassword: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
) {
  constructor(
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: getJwtSecret(),
    });
  }

  async validate(
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.users.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        username: true,
        is_active: true,
        must_change_password: true,
        persons: {
          select: {
            is_active: true,
          },
        },
        roles: {
          select: {
            code: true,
            is_active: true,
          },
        },
      },
    });

    if (
      !user ||
      !user.is_active ||
      !user.persons.is_active ||
      !user.roles.is_active
    ) {
      throw new UnauthorizedException();
    }

    return {
      sub: user.id,
      username: user.username,
      role: user.roles.code,
      mustChangePassword: user.must_change_password,
    };
  }
}
