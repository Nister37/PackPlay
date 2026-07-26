import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import {
  createAuthenticatedUser,
  createGroup,
  createActivity,
  createInvitation,
  cleanupUser,
} from './helpers';

describe('New Modules (integration)', () => {
  let app: INestApplication;
  let owner: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let member: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let groupId: string;
  let activityId: string;

  beforeAll(async () => {
    app = await createTestApp();
    owner = await createAuthenticatedUser(app, { name: 'Modules Owner' });
    member = await createAuthenticatedUser(app, { name: 'Modules Member' });

    const group = await createGroup(app, owner.accessToken);
    groupId = group.groupId;

    // Add member to group
    const { token } = await createInvitation(app, owner.accessToken, groupId);
    await request(app.getHttpServer())
      .post(`/invitations/${token}/join`)
      .set('Authorization', `Bearer ${member.accessToken}`);

    // Create an activity with outdoor environment, date, and location for weather tests
    const actRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/activities`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Outdoor Training',
        activityType: 'TRAINING',
        environment: 'OUTDOOR',
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        latitude: 52.23,
        longitude: 21.01,
        surface: 'grass',
      });
    activityId = actRes.body.id;
  });

  afterAll(async () => {
    await cleanupUser(app, owner.email);
    await cleanupUser(app, member.email);
    await app.close();
  });

  // ─── Event Planning: Templates ─────────────────────────────────────────

  describe('Preparation Templates', () => {
    let templateId: string;

    it('should create a template from an existing event', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/preparation-templates/from-events/${activityId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Training Template', description: 'Standard training prep' })
        .expect(201);

      expect(res.body.name).toBe('Training Template');
      expect(res.body.versions).toHaveLength(1);
      templateId = res.body.id;
    });

    it('should create an event from a template', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/preparation-templates/${templateId}/events`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Next Training', date: futureDate })
        .expect(201);

      expect(res.body.name).toBe('Next Training');
      expect(res.body.groupId).toBe(groupId);
    });
  });

  // ─── Event Planning: Recurrence ────────────────────────────────────────

  describe('Event Recurrence', () => {
    let recurrenceActivityId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Weekly Practice',
          activityType: 'TRAINING',
          date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        });
      recurrenceActivityId = res.body.id;
    });

    it('should create a recurrence series from an event', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/activities/${recurrenceActivityId}/recurrence`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          frequency: 'WEEKLY',
          interval: 1,
          daysOfWeek: [1, 3, 5],
          timezone: 'Europe/Warsaw',
          count: 4,
        })
        .expect(201);

      expect(res.body.seriesId).toBeDefined();
      expect(res.body.created).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Inventory ─────────────────────────────────────────────────────────

  describe('Inventory', () => {
    let itemId: string;
    let batchId: string;
    let custodyId: string;

    it('should create an inventory item', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/inventory`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Training Cones',
          category: 'equipment',
          trackingType: 'BATCH',
        })
        .expect(201);

      expect(res.body.name).toBe('Training Cones');
      itemId = res.body.id;
    });

    it('should create a batch for the item', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/inventory/${itemId}/batches`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ quantity: 20 })
        .expect(201);

      expect(res.body.quantity).toBe(20);
      expect(res.body.availableQuantity).toBe(20);
      batchId = res.body.id;
    });

    it('should checkout inventory to a member', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/inventory-operations/checkouts`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          batchId,
          holderId: member.userId,
          quantity: 5,
          purpose: 'Training session',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      custodyId = res.body.id;
    });

    it('should return checked-out inventory', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/inventory-operations/custodies/${custodyId}/return`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ quantity: 5 })
        .expect(201);

      expect(res.body).toBeDefined();
    });
  });

  // ─── Weather ───────────────────────────────────────────────────────────

  describe('Weather', () => {
    it('should refresh weather for an outdoor event', async () => {
      // This will call the real Open-Meteo API. If unavailable, it might 503.
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/activities/${activityId}/weather/refresh`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      // Either successfully refreshed (201) or provider unavailable (503)
      expect([201, 503]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.snapshot).toBeDefined();
      }
    });

    it('should get weather status for the activity', async () => {
      const res = await request(app.getHttpServer())
        .get(`/groups/${groupId}/activities/${activityId}/weather`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      // Returns snapshot data (may be null if refresh wasn't successful)
      expect(res.body).toBeDefined();
    });
  });

  // ─── Equipment Catalogue ───────────────────────────────────────────────

  describe('Equipment Catalogue', () => {
    it('should search the catalogue with results', async () => {
      const res = await request(app.getHttpServer())
        .get('/equipment-catalogue/search')
        .query({ query: 'ball' })
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return bootstrap catalogue data', async () => {
      const res = await request(app.getHttpServer())
        .get('/equipment-catalogue/bootstrap')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── Calendar Imports ──────────────────────────────────────────────────

  describe('Calendar Imports', () => {
    const validIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//Test//EN',
      'BEGIN:VEVENT',
      'UID:test-event-1@test.local',
      'DTSTART:20260901T100000Z',
      'DTEND:20260901T120000Z',
      'SUMMARY:Test Match',
      'LOCATION:Stadium',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    it('should preview iCalendar file content', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/calendar-feeds/preview-file`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ content: validIcs })
        .expect(201);

      expect(res.body.count).toBe(1);
      expect(res.body.events[0].title).toBe('Test Match');
    });

    it('should connect and import a calendar feed (file)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/calendar-feeds/import-file`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Season Schedule', content: validIcs })
        .expect(201);

      expect(res.body.feed).toBeDefined();
      expect(res.body.created).toBe(1);
    });
  });
});
