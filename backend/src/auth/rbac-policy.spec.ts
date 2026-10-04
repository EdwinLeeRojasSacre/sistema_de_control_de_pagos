import { ROLES_KEY } from './roles.decorator.js';
import { AcademicStructureController } from '../academic-structure/academic-structure.controller.js';
import { DashboardController } from '../dashboard/dashboard.controller.js';
import { EnrollmentsController } from '../enrollments/enrollments.controller.js';
import { FamilyGroupsController } from '../family-groups/family-groups.controller.js';
import { PaymentsController } from '../payments/payments.controller.js';
import { ReportsController } from '../reports/reports.controller.js';
import { SchoolPeriodsController } from '../school-periods/school-periods.controller.js';
import { StudentsController } from '../students/students.controller.js';
import { UsersController } from '../users/users.controller.js';

function allDeclaredRoles(controller: object) {
  const prototype = (controller as { prototype: object }).prototype;
  const roles: string[] = Reflect.getMetadata(ROLES_KEY, controller) ?? [];
  for (const name of Object.getOwnPropertyNames(prototype)) {
    const handler = (prototype as Record<string, unknown>)[name];
    if (typeof handler === 'function') roles.push(...(Reflect.getMetadata(ROLES_KEY, handler) ?? []));
  }
  return roles;
}

describe('definitive DIRECCION RBAC policy', () => {
  it('allows DIRECCION in reports', () => {
    expect(allDeclaredRoles(ReportsController)).toContain('DIRECCION');
  });

  it.each([
    DashboardController, EnrollmentsController,
    FamilyGroupsController, PaymentsController,
    StudentsController, UsersController,
  ])('does not allow DIRECCION in operational controller %s', (controller) => {
    expect(allDeclaredRoles(controller)).not.toContain('DIRECCION');
  });

  it('allows DIRECCION only on the school-period list method', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SchoolPeriodsController.prototype.findAll)).toContain('DIRECCION');
    expect(Reflect.getMetadata(ROLES_KEY, SchoolPeriodsController)).not.toContain('DIRECCION');
  });

  it('allows DIRECCION only on the academic structure read method', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AcademicStructureController.prototype.findByPeriod)).toContain('DIRECCION');
    expect(Reflect.getMetadata(ROLES_KEY, AcademicStructureController)).not.toContain('DIRECCION');
  });
});
