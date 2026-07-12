import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { createAuthenticatedUser, createGroup, createActivity, createInvitation, cleanupUser } from './helpers';

/**
 * End-to-end tests covering complete multi-user flows.
 * These test the full application stack through HTTP.
 */
describe('E2E: Complete Packing Flow', () => {
  let app: INestApplication;
  let captain: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let player1: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let player2: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let groupId: string;
  let activityId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Create 3 users
    captain = await createAuthenticatedUser(app, { name: 'Captain' });
    player1 = await createAuthenticatedUser(app, { name: 'Player One' });
    player2 = await createAuthenticatedUser(app, { name: 'Player Two' });
  });

  afterAll(async () => {
    await cleanupUser(app, captain.email);
    await cleanupUser(app, player1.email);
    await cleanupUser(app, player2.email);
    await app.close();
  });

  // ─── Flow 1: Group creation and invitation ─────────────────────────────

  describe('Flow 1: Create group → invite members → join', () => {
    it('captain creates a group', async () => {
      const res = await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .send({ name: 'Weekend Football', sportType: 'football' })
        .expect(201);

      groupId = res.body.id;
      expect(res.body.members[0].role).toBe('OWNER');
    });

    it('captain creates an activity', async () => {
      const res = await request(app.getHttpServer())
        .post(`/groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .send({ name: 'Sunday Match', activityType: 'COMPETITION' })
        .expect(201);

      activityId = res.body.id;
    });

    it('captain creates invitation and players join', async () => {
      const { token } = await createInvitation(app, captain.accessToken, groupId);

      await request(app.getHttpServer())
        .post(`/invitations/${token}/join`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/invitations/${token}/join`)
        .set('Authorization', `Bearer ${player2.accessToken}`)
        .expect(201);

      // Verify 3 members
      const membersRes = await request(app.getHttpServer())
        .get(`/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .expect(200);

      expect(membersRes.body).toHaveLength(3);
    });
  });

  // ─── Flow 2: Shared equipment assignment ───────────────────────────────

  describe('Flow 2: Add shared items → claim → pack', () => {
    let ballId: string;
    let waterId: string;
    let medkitId: string;

    it('captain adds shared items to the activity', async () => {
      const items = [
        { name: 'Football', requiredQuantity: 2 },
        { name: 'Water Cooler', requiredQuantity: 1 },
        { name: 'First Aid Kit', requiredQuantity: 1 },
      ];

      const results = await Promise.all(
        items.map((item) =>
          request(app.getHttpServer())
            .post(`/activities/${activityId}/shared-items`)
            .set('Authorization', `Bearer ${captain.accessToken}`)
            .send(item)
            .expect(201),
        ),
      );

      ballId = results[0].body.id;
      waterId = results[1].body.id;
      medkitId = results[2].body.id;
    });

    it('players claim responsibilities', async () => {
      // Player1 claims 1 football
      await request(app.getHttpServer())
        .post(`/shared-items/${ballId}/claim`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .send({ quantity: 1 })
        .expect(201);

      // Player2 claims 1 football
      await request(app.getHttpServer())
        .post(`/shared-items/${ballId}/claim`)
        .set('Authorization', `Bearer ${player2.accessToken}`)
        .send({ quantity: 1 })
        .expect(201);

      // Captain claims water cooler
      await request(app.getHttpServer())
        .post(`/shared-items/${waterId}/claim`)
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .send({ quantity: 1 })
        .expect(201);

      // Player1 claims medkit
      await request(app.getHttpServer())
        .post(`/shared-items/${medkitId}/claim`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .send({ quantity: 1 })
        .expect(201);
    });

    it('all items should be fully covered', async () => {
      const res = await request(app.getHttpServer())
        .get(`/activities/${activityId}/shared-items`)
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .expect(200);

      for (const item of res.body) {
        expect(item.coverage.uncoveredQuantity).toBe(0);
      }
    });

    it('players pack their items', async () => {
      await request(app.getHttpServer())
        .post(`/shared-items/${ballId}/pack`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .send({})
        .expect(200);

      await request(app.getHttpServer())
        .post(`/shared-items/${waterId}/pack`)
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .send({})
        .expect(200);
    });

    it('player2 forgets their football', async () => {
      await request(app.getHttpServer())
        .post(`/shared-items/${ballId}/report-missing`)
        .set('Authorization', `Bearer ${player2.accessToken}`)
        .send({ reason: 'FORGOT' })
        .expect(200);
    });

    it('captain takes over the missing football', async () => {
      await request(app.getHttpServer())
        .post(`/shared-items/${ballId}/take-over`)
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .send({ quantity: 1 })
        .expect(200);
    });

    it('notifications were created for the missing item', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications?page=1&limit=10')
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .expect(200);

      const missingNotif = res.body.data.find(
        (n: any) => n.type === 'ITEM_MISSING',
      );
      expect(missingNotif).toBeDefined();
    });
  });

  // ─── Flow 3: Packing session → readiness ───────────────────────────────

  describe('Flow 3: Personal packing session → readiness', () => {
    let profileId: string;
    let checklistId: string;
    let sessionId: string;
    let mandatoryItemId: string;
    let optionalItemId: string;

    it('player1 creates a sport profile and checklist', async () => {
      const profileRes = await request(app.getHttpServer())
        .post('/sport-profiles')
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .send({ name: 'Football', activityTypes: ['COMPETITION'] })
        .expect(201);
      profileId = profileRes.body.id;

      const checklistRes = await request(app.getHttpServer())
        .post('/checklists')
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .send({ sportProfileId: profileId, name: 'Match Day', activityType: 'COMPETITION' })
        .expect(201);
      checklistId = checklistRes.body.id;
    });

    it('player1 adds items to their checklist', async () => {
      const mandatory = await request(app.getHttpServer())
        .post(`/checklists/${checklistId}/items`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .send({ name: 'Boots', quantity: 1, isMandatory: true, sortOrder: 1 })
        .expect(201);
      mandatoryItemId = mandatory.body.id;

      const optional = await request(app.getHttpServer())
        .post(`/checklists/${checklistId}/items`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .send({ name: 'Extra socks', quantity: 1, isMandatory: false, sortOrder: 2 })
        .expect(201);
      optionalItemId = optional.body.id;
    });

    it('player1 starts a packing session', async () => {
      const res = await request(app.getHttpServer())
        .post('/packing-sessions')
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .send({ checklistId, groupActivityId: activityId })
        .expect(201);

      sessionId = res.body.id;
      expect(res.body.status).toBe('IN_PROGRESS');
    });

    it('player1 checks remaining items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/packing-sessions/${sessionId}/remaining`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .expect(200);

      // Only mandatory items in remaining
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Boots');
    });

    it('player1 packs mandatory item', async () => {
      await request(app.getHttpServer())
        .post(`/packing-sessions/${sessionId}/decisions`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .send({ equipmentItemId: mandatoryItemId, decision: 'PACKED' })
        .expect(201);
    });

    it('player1 completes session', async () => {
      const res = await request(app.getHttpServer())
        .post(`/packing-sessions/${sessionId}/complete`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .expect(200);

      expect(res.body.status).toBe('COMPLETED');
    });

    it('player1 personal readiness should be 100%', async () => {
      const res = await request(app.getHttpServer())
        .get(`/packing-sessions/${sessionId}/readiness`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .expect(200);

      expect(res.body.percentage).toBe(100);
    });

    it('cannot complete session with unresolved mandatory items', async () => {
      // Start a new session
      const sessionRes = await request(app.getHttpServer())
        .post('/packing-sessions')
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .send({ checklistId })
        .expect(201);

      // Try to complete without resolving mandatory items
      await request(app.getHttpServer())
        .post(`/packing-sessions/${sessionRes.body.id}/complete`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .expect(400);

      // Abandon it
      await request(app.getHttpServer())
        .post(`/packing-sessions/${sessionRes.body.id}/abandon`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .expect(200);
    });
  });

  // ─── Flow 4: Group readiness overview ──────────────────────────────────

  describe('Flow 4: Group readiness', () => {
    it('should show group readiness with member breakdown', async () => {
      const res = await request(app.getHttpServer())
        .get(`/activities/${activityId}/readiness`)
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .expect(200);

      expect(res.body.activityId).toBe(activityId);
      expect(res.body.memberReadiness).toBeInstanceOf(Array);
      expect(res.body.memberReadiness.length).toBe(3);

      // Player1 completed a session, should have > 0%
      const player1Readiness = res.body.memberReadiness.find(
        (m: any) => m.userId === player1.userId,
      );
      expect(player1Readiness.percentage).toBe(100);
    });
  });

  // ─── Flow 5: Transfer and leave ────────────────────────────────────────

  describe('Flow 5: Transfer ownership and leave', () => {
    it('captain transfers ownership to player1', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupId}/transfer-ownership`)
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .send({ targetUserId: player1.userId })
        .expect(200);
    });

    it('captain (now ADMIN) can leave the group', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupId}/leave`)
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .expect(204);
    });

    it('captain can no longer access the group', async () => {
      await request(app.getHttpServer())
        .get(`/groups/${groupId}`)
        .set('Authorization', `Bearer ${captain.accessToken}`)
        .expect(403);
    });

    it('player1 is now the owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${player1.accessToken}`)
        .expect(200);

      const player1Member = res.body.find((m: any) => m.userId === player1.userId);
      expect(player1Member.role).toBe('OWNER');
    });
  });
});
