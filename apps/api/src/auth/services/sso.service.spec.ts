import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SsoIntent, SsoProvider } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuthService } from './auth.service';
import { SsoCryptoService } from './sso-crypto.service';
import { SsoService } from './sso.service';

describe('SsoService', () => {
  const prisma = {
    ssoAuthorization: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    externalIdentity: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
  };
  const crypto = {
    randomValue: jest.fn().mockReturnValue('random-value-with-enough-entropy'),
    hash: jest.fn((value: string) => `hash:${value}`),
    encrypt: jest.fn((value: string) => `encrypted:${value}`),
    decrypt: jest.fn().mockReturnValue('code-verifier'),
    required: jest.fn((name: string) =>
      name === 'GOOGLE_CLIENT_ID' ? 'client-id' : 'client-secret',
    ),
    validateGoogleIdToken: jest.fn(),
  };
  const auth = { createLoginSession: jest.fn() };
  const config = {
    get: jest.fn((_name: string, fallback?: string) => fallback),
  };
  const service = new SsoService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    crypto as unknown as SsoCryptoService,
    auth as unknown as AuthService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a short-lived PKCE authorization request', async () => {
    prisma.ssoAuthorization.create.mockResolvedValue({});

    const result = await service.start(SsoIntent.SIGN_IN);
    const url = new URL(result.authorizationUrl);

    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(prisma.ssoAuthorization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stateHash: expect.stringContaining('hash:'),
          intent: SsoIntent.SIGN_IN,
          encryptedCodeVerifier: expect.stringContaining('encrypted:'),
        }),
      }),
    );
  });

  it('requires explicit linking when a verified SSO email already exists', async () => {
    prisma.ssoAuthorization.findUnique.mockResolvedValue({
      id: 'authorization',
      intent: SsoIntent.SIGN_IN,
      userId: null,
      encryptedCodeVerifier: 'encrypted',
      nonceHash: 'nonce-hash',
      returnUrl: null,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    prisma.ssoAuthorization.updateMany.mockResolvedValue({ count: 1 });
    prisma.externalIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 'existing-user',
      email: 'member@example.com',
    });
    crypto.validateGoogleIdToken.mockResolvedValue({
      sub: 'google-user',
      email: 'Member@Example.com',
      email_verified: true,
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id_token: 'signed-token' }), { status: 200 }),
      );

    await expect(service.callback('authorization-code', 'state')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.externalIdentity.create).not.toHaveBeenCalled();
  });

  it('prevents removal of the only sign-in method', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      identity: null,
      externalIdentities: [{ id: 'google', provider: SsoProvider.GOOGLE }],
    });

    await expect(service.unlink('user', SsoProvider.GOOGLE)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.externalIdentity.delete).not.toHaveBeenCalled();
  });
});
