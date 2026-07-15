import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { createAuthenticatedUser, cleanupUser } from './helpers';

describe('Sport Profiles & Checklists (integration)', () => {
  let app: INestApplication;
  let user: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let profileId: string;
  let checklistId: string;
  let itemId: string;

  beforeAll(async () => {
    app = await createTestApp();
    user = await createAuthenticatedUser(app);
  });

  afterAll(async () => {
    await cleanupUser(app, user.email);
    await app.close();
  });

  // ─── Sport Profiles ────────────────────────────────────────────────────

  describe('Sport Profiles', () => {
    it('POST /sport-profiles — should create a profile', async () => {
      const res = await request(app.getHttpServer())
        .post('/sport-profiles')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Hiking', activityTypes: ['CASUAL', 'TRAINING'] })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Hiking');
      profileId = res.body.id;
    });

    it('GET /sport-profiles — should list profiles', async () => {
      const res = await request(app.getHttpServer())
        .get('/sport-profiles')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /sport-profiles/:id — should get profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/sport-profiles/${profileId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.name).toBe('Hiking');
    });

    it('PATCH /sport-profiles/:id — should update profile', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/sport-profiles/${profileId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Mountain Hiking' })
        .expect(200);

      expect(res.body.name).toBe('Mountain Hiking');
    });

    it('should not allow another user to access my profile', async () => {
      const other = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .get(`/sport-profiles/${profileId}`)
        .set('Authorization', `Bearer ${other.accessToken}`)
        .expect(404);
      await cleanupUser(app, other.email);
    });
  });

  // ─── Checklists ────────────────────────────────────────────────────────

  describe('Checklists', () => {
    it('POST /checklists — should create a checklist', async () => {
      const res = await request(app.getHttpServer())
        .post('/checklists')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          sportProfileId: profileId,
          name: 'Day Hike Essentials',
          activityType: 'CASUAL',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Day Hike Essentials');
      checklistId = res.body.id;
    });

    it('GET /checklists — should list checklists', async () => {
      const res = await request(app.getHttpServer())
        .get('/checklists')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /checklists?sportProfileId= — should filter by profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/checklists?sportProfileId=${profileId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.every((c: any) => c.sportProfileId === profileId)).toBe(true);
    });

    it('POST /checklists/:id/duplicate — should duplicate', async () => {
      const res = await request(app.getHttpServer())
        .post(`/checklists/${checklistId}/duplicate`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(201);

      expect(res.body.id).not.toBe(checklistId);
      expect(res.body.name).toContain('Day Hike Essentials');
    });
  });

  // ─── Equipment Items ───────────────────────────────────────────────────

  describe('Equipment Items', () => {
    it('POST /checklists/:id/items — should add item', async () => {
      const res = await request(app.getHttpServer())
        .post(`/checklists/${checklistId}/items`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Water Bottle',
          quantity: 2,
          category: 'Hydration',
          isMandatory: true,
          sortOrder: 1,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Water Bottle');
      itemId = res.body.id;
    });

    it('PATCH /checklists/:id/items/:itemId — should update item', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/checklists/${checklistId}/items/${itemId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Water Bottle (1L)' })
        .expect(200);

      expect(res.body.name).toBe('Water Bottle (1L)');
    });

    it('GET /checklists/:id — should include items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/checklists/${checklistId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.items).toBeInstanceOf(Array);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('DELETE /checklists/:id/items/:itemId — should remove item', async () => {
      await request(app.getHttpServer())
        .delete(`/checklists/${checklistId}/items/${itemId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(204);

      // Verify item is gone
      const res = await request(app.getHttpServer())
        .get(`/checklists/${checklistId}`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      const found = res.body.items.find((i: any) => i.id === itemId);
      expect(found).toBeUndefined();
    });
  });
});
