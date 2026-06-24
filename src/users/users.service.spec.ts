import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { AuthSession } from '../auth/entities/auth-session.entity';

type AuditLogInput = {
  action: string;
  metadata?: {
    email_changed?: boolean;
    sessions_revoked?: number;
    access_state?: string;
  };
};

const currentUser = {
  sub: 'super-admin-id',
  id: 'super-admin-id',
  name: 'Super Admin',
  email: 'super@example.com',
  role: 'SUPER_ADMIN' as const,
  tenant_id: null,
  tenant: null,
  tenant_dashboard_tour_completed_at: null,
  session_id: 'session-id',
  token_version: 0,
  is_active: true,
};

function makeTenantAdmin(overrides: Partial<User> = {}): User {
  return {
    id: 'tenant-admin-id',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    name: 'Tenant Admin',
    email: 'admin@example.com',
    password_hash: 'hashed-password',
    role: 'TENANT_ADMIN',
    tenant_id: 'tenant-id',
    tenant: {
      id: 'tenant-id',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      name: 'Tenant',
      slug: 'tenant',
      is_active: true,
    },
    is_active: true,
    email_verified_at: new Date('2026-01-01T00:00:00.000Z'),
    invited_at: new Date('2026-01-01T00:00:00.000Z'),
    onboarding_completed_at: new Date('2026-01-01T00:00:00.000Z'),
    token_version: 3,
    failed_login_attempts: 0,
    last_failed_login_at: null,
    locked_until: null,
    last_login_at: null,
    tenant_dashboard_tour_completed_at: null,
    ...overrides,
  };
}

function createServiceTestBed(initialUser: User) {
  let storedUser = initialUser;
  const authSessionsRepo = {
    update: jest.fn().mockResolvedValue({ affected: 2 }),
  };
  const transactionalUsersRepo = {
    findOne: jest
      .fn<() => Promise<User>>()
      .mockImplementation(() => Promise.resolve(storedUser)),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest
      .fn<(user: User) => Promise<User>>()
      .mockImplementation((user) => {
        const nextStoredUser = user as User;
        storedUser = nextStoredUser;
        return Promise.resolve(storedUser);
      }),
  };
  const manager = {
    getRepository: jest
      .fn<
        (
          entity: typeof User | typeof AuthSession,
        ) => typeof transactionalUsersRepo | typeof authSessionsRepo
      >()
      .mockImplementation((entity) => {
        if (entity === User) return transactionalUsersRepo;
        if (entity === AuthSession) return authSessionsRepo;
        throw new Error('Unexpected repository');
      }),
  };
  const usersRepo = {
    manager: {
      transaction: <T>(
        callback: (transactionManager: typeof manager) => Promise<T>,
      ): Promise<T> => callback(manager),
    },
    findOne: jest
      .fn<() => Promise<User>>()
      .mockImplementation(() => Promise.resolve(storedUser)),
  };
  const tenantRepo = {
    findOneBy: jest.fn(),
  };
  const auditService = {
    log: jest
      .fn<(input: AuditLogInput) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  const accountAccessService = {
    issueTenantAdminInvitation: jest
      .fn()
      .mockResolvedValue({ expires_at: new Date() }),
  };

  const service = new UserService(
    usersRepo as never,
    tenantRepo as never,
    auditService as never,
    accountAccessService as never,
  );

  return {
    service,
    usersRepo,
    transactionalUsersRepo,
    authSessionsRepo,
    auditService,
    accountAccessService,
    getStoredUser: () => storedUser,
  };
}

describe('UsersService', () => {
  it('resets onboarding, bumps token version, revokes sessions and sends invitation when email changes', async () => {
    const bed = createServiceTestBed(makeTenantAdmin());

    const result = await bed.service.updateTenantAdmin(
      'tenant-admin-id',
      { email: 'NEW@example.com' },
      currentUser,
    );

    const savedUser = bed.getStoredUser();
    expect(result.email).toBe('new@example.com');
    expect(savedUser.password_hash).toBeNull();
    expect(savedUser.email_verified_at).toBeNull();
    expect(savedUser.onboarding_completed_at).toBeNull();
    expect(savedUser.token_version).toBe(4);
    expect(bed.authSessionsRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'tenant-admin-id',
      }),
      expect.objectContaining({
        revocation_reason: 'EMAIL_CHANGED',
      }),
    );
    expect(
      bed.accountAccessService.issueTenantAdminInvitation,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com' }),
      currentUser,
    );
    const auditCalls = bed.auditService.log.mock.calls as [AuditLogInput][];
    const auditPayload = auditCalls[0]?.[0];
    expect(auditPayload).toMatchObject({
      action: 'TENANT_ADMIN_EMAIL_CHANGED',
      metadata: {
        email_changed: true,
        sessions_revoked: 2,
        access_state: 'INVITED',
      },
    });
  });

  it('bumps token version and revokes sessions when tenant admin is disabled', async () => {
    const bed = createServiceTestBed(makeTenantAdmin());

    const result = await bed.service.updateTenantAdmin(
      'tenant-admin-id',
      { is_active: false },
      currentUser,
    );

    expect(result.is_active).toBe(false);
    expect(bed.getStoredUser().token_version).toBe(4);
    expect(bed.authSessionsRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'tenant-admin-id',
      }),
      expect.objectContaining({
        revocation_reason: 'USER_DISABLED',
      }),
    );
    expect(
      bed.accountAccessService.issueTenantAdminInvitation,
    ).not.toHaveBeenCalled();
  });

  it('does not revoke sessions for non-sensitive profile changes', async () => {
    const bed = createServiceTestBed(makeTenantAdmin());

    const result = await bed.service.updateTenantAdmin(
      'tenant-admin-id',
      { name: 'Updated Name' },
      currentUser,
    );

    expect(result.name).toBe('Updated Name');
    expect(bed.getStoredUser().token_version).toBe(3);
    expect(bed.authSessionsRepo.update).not.toHaveBeenCalled();
    expect(
      bed.accountAccessService.issueTenantAdminInvitation,
    ).not.toHaveBeenCalled();
  });
});
