import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/common/prisma.service';

/**
 * Creates a user, verifies email directly in DB, and logs in.
 * Returns { userId, accessToken, refreshToken, email }
 */
export async function createAuthenticatedUser(
  app: INestApplication,
  overrides?: { email?: string; password?: string; name?: string },
) {
  const prisma = app.get(PrismaService);
  const email = overrides?.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const password = overrides?.password ?? 'TestPass123';
  const name = overrides?.name ?? 'Test User';

  // Register
  const registerRes = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, name });

  const userId = registerRes.body.userId;

  // Verify email directly in DB (bypass email flow for testing)
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });

  // Login
  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });

  return {
    userId,
    email,
    password,
    accessToken: loginRes.body.accessToken as string,
    refreshToken: loginRes.body.refreshToken as string,
  };
}

/**
 * Creates a group and returns { groupId, activityId }
 */
export async function createGroup(
  app: INestApplication,
  accessToken: string,
  overrides?: { name?: string; sportType?: string },
) {
  const groupRes = await request(app.getHttpServer())
    .post('/groups')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      name: overrides?.name ?? 'Test Group',
      sportType: overrides?.sportType ?? 'hiking',
    });

  return { groupId: groupRes.body.id as string };
}

/**
 * Creates a group activity
 */
export async function createActivity(
  app: INestApplication,
  accessToken: string,
  groupId: string,
) {
  const res = await request(app.getHttpServer())
    .post(`/groups/${groupId}/activities`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'Test Activity', activityType: 'CASUAL' });

  return { activityId: res.body.id as string };
}

/**
 * Creates an invitation and returns the token
 */
export async function createInvitation(
  app: INestApplication,
  accessToken: string,
  groupId: string,
) {
  const res = await request(app.getHttpServer())
    .post(`/groups/${groupId}/invitations`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ expiresInHours: 24, maxUses: 50 });

  return { token: res.body.token as string, id: res.body.id as string };
}

/**
 * Clean up a user and all their data
 */
export async function cleanupUser(app: INestApplication, email: string) {
  const prisma = app.get(PrismaService);
  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
}
