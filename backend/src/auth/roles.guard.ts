import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ROLES_KEY } from './roles.decorator.js';
import type { AuthenticatedUser } from './jwt.strategy.js';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {

    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (!requiredRoles) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const user = request.user;

    if (user?.mustChangePassword) {
      throw new ForbiddenException({
        message: 'Debe cambiar su contraseña antes de continuar',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    return Boolean(
      user && requiredRoles.includes(user.role),
    );
  }
}
