import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { createAuthenticatedUser, createGroup, createActivity, createInvitation, cleanupUser } from './helpers';

describe('Shared Equipment (integration)', () => {
  let app: INestApplication;
  let owner: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let member: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let groupId: string;
  let activityId: string;
  let sharedItemId: string;

  beforeAll(async () => {
    app = await createTestApp();
    owner = await createAuthenticatedUser(app, { name: 'Equipment Owner' });
    member = await createAuthenticatedUser(app, { name: 'Equipment Member' });

    const group = await createGroup(app, owner.accessToken);
    groupId = group.groupId;

    const activity = await createActivity(app, owner.accessToken, groupId);
    activityId = activity.activityId;

    // Add member to group
    const { token } = await createInvitation(app, owner.accessToken, groupId);
    await request(app.getHttpServer())
      .post(`/invitations/${token}/join`)
      .set('Authorization', `Bearer ${member.accessToken}`);
  });

  afterAll(async () => {
    await cleanupUser(app, owner.email);
    await cleanupUser(app, member.email);
    await app.close();
  });

  describe('Shared Items CRUD', () => {
    it('should create a shared item', async () => {
      const res = await request(app.getHttpServer())
        .post(`/activities/${activityId}/shared-items`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'First Aid Kit', requiredQuantity: 2, isMandatory: true })
        .expect(201);

      expect(res.body.name).toBe('First Aid Kit');
      expect(res.body.requiredQuantity).toBe(2);
      sharedItemId = res.body.id;
    });

    it('should list shared items with coverage', async () => {
      const res = await request(app.getHttpServer())
        .get(`/activities/${activityId}/shared-items`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0].coverage).toBeDefined();
      expect(res.body[0].coverage.uncoveredQuantity).toBe(2);
    });
  });

  describe('Responsibility lifecycle', () => {
    it('owner should claim 1 unit', async () => {
      const res = await request(app.getHttpServer())
        .post(`/shared-items/${sharedItemId}/claim`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ quantity: 1 })
        .expect(201);

      expect(res.body.committedQuantity).toBe(1);
      expect(res.body.status).toBe('COMMITTED');
    });

    it('member should claim remaining 1 unit', async () => {
      const res = await request(app.getHttpServer())
        .post(`/shared-items/${sharedItemId}/claim`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ quantity: 1 })
        .expect(201);

      expect(res.body.committedQuantity).toBe(1);
    });

    it('should reject over-claiming (all units taken)', async () => {
      const third = await createAuthenticatedUser(app);
      const { token } = await createInvitation(app, owner.accessToken, groupId);
      await request(app.getHttpServer())
        .post(`/invitations/${token}/join`)
        .set('Authorization', `Bearer ${third.accessToken}`);

      await request(app.getHttpServer())
        .post(`/shared-items/${sharedItemId}/claim`)
        .set('Authorization', `Bearer ${third.accessToken}`)
        .send({ quantity: 1 })
        .expect(409);

      await cleanupUser(app, third.email);
    });

    it('should show fully covered status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/shared-items/${sharedItemId}/coverage`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body.uncoveredQuantity).toBe(0);
      expect(res.body.committedQuantity).toBe(2);
    });

    it('owner should pack their unit', async () => {
      const res = await request(app.getHttpServer())
        .post(`/shared-items/${sharedItemId}/pack`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({})
        .expect(200);

      expect(res.body.status).toBe('PACKED');
    });

    it('member should report missing (FORGOT)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/shared-items/${sharedItemId}/report-missing`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ reason: 'FORGOT' })
        .expect(200);

      expect(res.body.status).toBe('FORGOT');
    });

    it('owner should take over the missing item', async () => {
      const res = await request(app.getHttpServer())
        .post(`/shared-items/${sharedItemId}/take-over`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ quantity: 1 })
        .expect(200);

      expect(res.body.status).toBe('COMMITTED');
    });
  });

  describe('Readiness', () => {
    it('should return group readiness', async () => {
      const res = await request(app.getHttpServer())
        .get(`/activities/${activityId}/readiness`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body.activityId).toBe(activityId);
      expect(res.body.totalSharedItems).toBeGreaterThan(0);
      expect(typeof res.body.groupPercentage).toBe('number');
      expect(res.body.memberReadiness).toBeInstanceOf(Array);
    });
  });
});
