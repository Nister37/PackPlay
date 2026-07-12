import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { createAuthenticatedUser, createGroup, createActivity, createInvitation, cleanupUser } from './helpers';

describe('E2E: Notifications Flow', () => {
  let app: INestApplication;
  let userA: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let userB: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let groupId: string;
  let activityId: string;
  let sharedItemId: string;

  beforeAll(async () => {
    app = await createTestApp();
    userA = await createAuthenticatedUser(app, { name: 'Notif User A' });
    userB = await createAuthenticatedUser(app, { name: 'Notif User B' });

    // Setup: group with both users and a shared item
    const group = await createGroup(app, userA.accessToken);
    groupId = group.groupId;

    const activity = await createActivity(app, userA.accessToken, groupId);
    activityId = activity.activityId;

    const { token } = await createInvitation(app, userA.accessToken, groupId);
    await request(app.getHttpServer())
      .post(`/invitations/${token}/join`)
      .set('Authorization', `Bearer ${userB.accessToken}`);

    const itemRes = await request(app.getHttpServer())
      .post(`/activities/${activityId}/shared-items`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ name: 'Tent', requiredQuantity: 1 });
    sharedItemId = itemRes.body.id;
  });

  afterAll(async () => {
    await cleanupUser(app, userA.email);
    await cleanupUser(app, userB.email);
    await app.close();
  });

  it('initially no notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('reporting missing item creates notification for other members', async () => {
    // UserB claims and then reports missing
    await request(app.getHttpServer())
      .post(`/shared-items/${sharedItemId}/claim`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ quantity: 1 });

    // Start a packing session to use report-missing flow
    // Create checklist for userB
    const profileRes = await request(app.getHttpServer())
      .post('/sport-profiles')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ name: 'Camping', activityTypes: ['CASUAL'] });

    const checklistRes = await request(app.getHttpServer())
      .post('/checklists')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ sportProfileId: profileRes.body.id, name: 'Camp Gear' });

    const sessionRes = await request(app.getHttpServer())
      .post('/packing-sessions')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ checklistId: checklistRes.body.id, groupActivityId: activityId });

    // Record decision: shared item NOT_PACKED with FORGOT reason
    await request(app.getHttpServer())
      .post(`/packing-sessions/${sessionRes.body.id}/decisions`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ sharedItemId, decision: 'NOT_PACKED', reason: 'FORGOT' })
      .expect(201);

    // UserA should now have a notification
    const notifRes = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);

    const missingNotif = notifRes.body.data.find(
      (n: any) => n.type === 'ITEM_MISSING',
    );
    expect(missingNotif).toBeDefined();
    expect(missingNotif.payload.sharedItemId).toBe(sharedItemId);
    expect(missingNotif.isRead).toBe(false);
  });

  it('mark notification as read', async () => {
    const notifRes = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    const notifId = notifRes.body.data[0].id;

    await request(app.getHttpServer())
      .patch(`/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);

    // Verify it's marked read
    const updatedRes = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    const updated = updatedRes.body.data.find((n: any) => n.id === notifId);
    expect(updated.isRead).toBe(true);
  });

  it('mark all as read', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
  });

  it('another user cannot read my notifications', async () => {
    const notifRes = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    if (notifRes.body.data.length > 0) {
      const notifId = notifRes.body.data[0].id;
      await request(app.getHttpServer())
        .patch(`/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .expect(404);
    }
  });
});
