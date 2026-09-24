import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function createContext(user: { role: Role } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard (HU10)', () => {
  it('CA: permite el acceso si el endpoint no restringe roles', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext({ role: Role.STUDENT }))).toBe(true);
  });

  it('CA: permite el acceso si el rol del usuario está en la lista permitida', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.PROFESSOR]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext({ role: Role.PROFESSOR }))).toBe(true);
  });

  it('CA: un usuario no puede acceder a funcionalidades reservadas a otro rol', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext({ role: Role.STUDENT }))).toThrow(
      ForbiddenException,
    );
  });
});
