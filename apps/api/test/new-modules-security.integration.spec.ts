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

describe('New Modules Security (integration)', () => {
  let app: INestApplication;
  let ownerA: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let memberA: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let outsider: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let groupAId: string;
  let groupBId: string;
  let activityAId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerA = await createAuthenticatedUser(app, { name: 'Owner A' });
    memberA = await createAuthenticatedUser(app, { name: 'Member A' });
    outsider = await createAuthenticatedUser(app, { name: 'Outsider' });

    // Create group A with owner and member
    const groupA = await createGroup(app, ownerA.accessToken, { name: 'Group A' });
    groupAId = groupA.groupId;

    const { token: tokenA } = await createInvitation(app, ownerA.accessToken, groupAId);
    await request(app.getHttpServer())
      .post(`/invitations/${tokenA}/join`)
      .set('Authorization', `Bearer ${memberA.accessToken}`);

    // Create group B (owned by outsider) - outsider is NOT in group A
    const groupB = await createGroup(app, outsider.accessToken, { name: 'Group B' });
    groupBId = groupB.groupId;

    // Create an activity in group A
    const actRes = await request(app.getHttpServer())
      .post(`/groups/${groupAId}/activities`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({
        name: 'Security Test Activity',
        activityType: 'TRAINING',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    activityAId = actRes.body.id;
  });

  afterAll(async () => {
    await cleanupUser(app, ownerA.email);
    await cleanupUser(app, memberA.email);
    await cleanupUser(app, outsider.email);
    await app.close();
  });

  // ─── Inventory: Role enforcement ──────────────────────────────────────

  describe('Inventory role enforcement', () => {
    it('non-member cannot access group inventory', async () => {
      await request(app.getHttpServer())
        .get(`/groups/${groupAId}/inventory`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(403);
    });

    it('MEMBER role cannot create inventory items (requires OWNER/ADMIN)', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupAId}/inventory`)
        .set('Authorization', `Bearer ${memberA.accessToken}`)
        .send({
          name: 'Unauthorized Item',
          trackingType: 'BATCH',
        })
        .expect(403);
    });

    it('MEMBER role can read inventory', async () => {
      await request(app.getHttpServer())
        .get(`/groups/${groupAId}/inventory`)
        .set('Authorization', `Bearer ${memberA.accessToken}`)
        .expect(200);
    });
  });

  // ─── Event Planning: Role enforcement ─────────────────────────────────

  describe('Event Planning role enforcement', () => {
    it('non-member cannot create event roles', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupAId}/activities/${activityAId}/roles`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ name: 'Goalkeeper', requirements: null })
        .expect(403);
    });

    it('non-member cannot create recurrence', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupAId}/activities/${activityAId}/recurrence`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({
          frequency: 'WEEKLY',
          timezone: 'UTC',
          count: 3,
        })
        .expect(403);
    });

    it('MEMBER cannot create preparation templates (requires OWNER/ADMIN)', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupAId}/preparation-templates/from-events/${activityAId}`)
        .set('Authorization', `Bearer ${memberA.accessToken}`)
        .send({ name: 'Unauthorized Template' })
        .expect(403);
    });

    it('MEMBER cannot create recurrence (requires OWNER/ADMIN)', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupAId}/activities/${activityAId}/recurrence`)
        .set('Authorization', `Bearer ${memberA.accessToken}`)
        .send({
          frequency: 'WEEKLY',
          timezone: 'UTC',
          count: 3,
        })
        .expect(403);
    });
  });

  // ─── Equipment Catalogue: Group membership ────────────────────────────

  describe('Equipment Catalogue group membership', () => {
    it('user must be group member to get team-boosted results', async () => {
      await request(app.getHttpServer())
        .get('/equipment-catalogue/search')
        .query({ query: 'ball', groupId: groupAId })
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(404);
    });

    it('group member can search with team boost', async () => {
      const res = await request(app.getHttpServer())
        .get('/equipment-catalogue/search')
        .query({ query: 'ball', groupId: groupAId })
        .set('Authorization', `Bearer ${ownerA.accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── Calendar Imports: Role enforcement ────────────────────────────────

  describe('Calendar Imports role enforcement', () => {
    const validIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//Test//EN',
      'BEGIN:VEVENT',
      'UID:sec-test-1@test.local',
      'DTSTART:20260901T100000Z',
      'DTEND:20260901T120000Z',
      'SUMMARY:Security Test',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    it('non-member cannot connect calendar feeds', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupAId}/calendar-feeds`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({
          url: 'https://example.com/calendar.ics',
          name: 'Unauthorized Feed',
        })
        .expect(403);
    });

    it('MEMBER cannot connect calendar feeds (requires OWNER/ADMIN)', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupAId}/calendar-feeds`)
        .set('Authorization', `Bearer ${memberA.accessToken}`)
        .send({
          url: 'https://example.com/calendar.ics',
          name: 'Unauthorized Feed',
        })
        .expect(403);
    });

    it('non-member cannot preview calendar files for another group', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupAId}/calendar-feeds/preview-file`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ content: validIcs })
        .expect(403);
    });
  });

  // ─── Cross-group isolation ─────────────────────────────────────────────

  describe('Cross-group isolation', () => {
    let groupBActivityId: string;
    let groupBItemId: string;

    beforeAll(async () => {
      // Create resources in group B
      const actRes = await request(app.getHttpServer())
        .post(`/groups/${groupBId}/activities`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ name: 'Group B Activity', activityType: 'CASUAL' });
      groupBActivityId = actRes.body.id;

      const itemRes = await request(app.getHttpServer())
        .post(`/groups/${groupBId}/inventory`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ name: 'Group B Item', trackingType: 'BATCH' });
      groupBItemId = itemRes.body.id;
    });

    it('user in group A cannot access group B inventory', async () => {
      await request(app.getHttpServer())
        .get(`/groups/${groupBId}/inventory`)
        .set('Authorization', `Bearer ${ownerA.accessToken}`)
        .expect(403);
    });

    it('user in group A cannot access group B inventory item', async () => {
      await request(app.getHttpServer())
        .get(`/groups/${groupBId}/inventory/${groupBItemId}`)
        .set('Authorization', `Bearer ${ownerA.accessToken}`)
        .expect(403);
    });

    it('user in group A cannot access group B events', async () => {
      await request(app.getHttpServer())
        .get(`/groups/${groupBId}/activities/${groupBActivityId}/members`)
        .set('Authorization', `Bearer ${ownerA.accessToken}`)
        .expect(403);
    });

    it('user in group A cannot create resources in group B', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupBId}/inventory`)
        .set('Authorization', `Bearer ${ownerA.accessToken}`)
        .send({ name: 'Cross-group Item', trackingType: 'BATCH' })
        .expect(403);
    });

    it('user in group A cannot access group B calendar feeds', async () => {
      await request(app.getHttpServer())
        .get(`/groups/${groupBId}/calendar-feeds`)
        .set('Authorization', `Bearer ${ownerA.accessToken}`)
        .expect(403);
    });
  });
});
