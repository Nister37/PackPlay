import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { PrismaService } from '../src/common/prisma.service';

describe('Groups (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let groupId: string;

  const email = `groups-${Date.now()}@integration.test`;
  const password = 'IntTest123';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // Create and verify user directly
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Group Tester' });
    userId = res.body.userId;

    await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('POST /groups — should create group', async () => {
    const res = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Test Group', sportType: 'hiking' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test Group');
    groupId = res.body.id;
  });

  it('GET /groups — should list user groups', async () => {
    const res = await request(app.getHttpServer())
      .get('/groups')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /groups/:groupId — should return group details', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(groupId);
    expect(res.body.members).toBeInstanceOf(Array);
  });

  it('POST /groups/:groupId/invitations — should create invitation', async () => {
    const res = await request(app.getHttpServer())
      .post(`/groups/${groupId}/invitations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ expiresInHours: 24 })
      .expect(201);

    expect(res.body.token).toBeDefined();
    expect(res.body.expiresAt).toBeDefined();
  });

  it('GET /groups/:groupId — should reject non-member', async () => {
    // Register another user
    const otherEmail = `other-${Date.now()}@integration.test`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: otherEmail, password, name: 'Other' });
    await prisma.user.update({ where: { email: otherEmail }, data: { emailVerified: true } });
    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: otherEmail, password });

    await request(app.getHttpServer())
      .get(`/groups/${groupId}`)
      .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      .expect(403);

    // Cleanup
    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
