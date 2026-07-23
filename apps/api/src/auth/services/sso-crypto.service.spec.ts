import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, sign } from 'crypto';
import { SsoCryptoService } from './sso-crypto.service';

describe('SsoCryptoService', () => {
  const config = {
    get: jest.fn((name: string) => {
      if (name === 'GOOGLE_CLIENT_ID') return 'packplay-client';
      if (name === 'SSO_STATE_ENCRYPTION_KEY') return 'test-state-encryption-key';
      return undefined;
    }),
  } as unknown as ConfigService;
  const service = new SsoCryptoService(config);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('encrypts authorization secrets with randomized authenticated encryption', () => {
    const first = service.encrypt('verifier');
    const second = service.encrypt('verifier');

    expect(first).not.toBe(second);
    expect(first).not.toContain('verifier');
    expect(service.decrypt(first)).toBe('verifier');
  });

  it('validates signed Google claims, audience, expiry, and nonce', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const jwk = publicKey.export({ format: 'jwk' });
    const nonce = 'one-time-nonce';
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'key-1' })).toString(
      'base64url',
    );
    const payload = Buffer.from(
      JSON.stringify({
        iss: 'https://accounts.google.com',
        aud: 'packplay-client',
        sub: 'google-user',
        email: 'member@example.com',
        email_verified: true,
        nonce,
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ).toString('base64url');
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString(
      'base64url',
    );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'key-1', alg: 'RS256' }] }), {
          status: 200,
          headers: { 'cache-control': 'max-age=60' },
        }),
      );

    await expect(
      service.validateGoogleIdToken(`${header}.${payload}.${signature}`, service.hash(nonce)),
    ).resolves.toMatchObject({
      sub: 'google-user',
      email: 'member@example.com',
    });
  });
});
