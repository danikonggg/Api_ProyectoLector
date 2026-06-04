import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

const makeCtx = (user: unknown, roles?: string[]): ExecutionContext => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return ctx;
};

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  it('allows when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: null }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows admin when role is administrador', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['administrador']);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { tipoPersona: 'administrador', administrador: { id: 1 } },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks director when role is administrador', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['administrador']);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { tipoPersona: 'director', director: { id: 1 } },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows admin OR director when both roles listed', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['administrador', 'director']);
    const ctxAdmin = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { tipoPersona: 'administrador', administrador: { id: 1 } },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    const ctxDirector = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { tipoPersona: 'director', director: { id: 1 } },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctxAdmin)).toBe(true);
    expect(guard.canActivate(ctxDirector)).toBe(true);
  });

  it('blocks user with correct tipoPersona but missing relation object', () => {
    // Covers the case where tipoPersona = 'administrador' but administrador relation = null
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['administrador']);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { tipoPersona: 'administrador', administrador: null },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is null and roles required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['administrador']);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: null }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it.each([
    ['alumno', { tipoPersona: 'alumno', alumno: { id: 5 } }, true],
    ['maestro', { tipoPersona: 'maestro', maestro: { id: 3 } }, true],
    ['padre', { tipoPersona: 'padre', padre: { id: 2 } }, true],
  ])('allows %s with matching role', (_role, user, expected) => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([user.tipoPersona]);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(expected);
  });
});

// Metadata key export verification
describe('ROLES_KEY', () => {
  it('is a non-empty string', () => {
    expect(typeof ROLES_KEY).toBe('string');
    expect(ROLES_KEY.length).toBeGreaterThan(0);
  });
});
