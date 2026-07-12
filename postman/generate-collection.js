/**
 * Generates PackPlay.postman_collection.json
 * Run: node postman/generate-collection.js
 */
const fs = require('fs');
const path = require('path');

const BASE = '{{baseUrl}}';

function req(name, method, url, body, tests, auth) {
  const r = {
    name,
    request: {
      method,
      header: [{ key: 'Content-Type', value: 'application/json' }],
      url: { raw: `${BASE}${url}`, host: ['{{baseUrl}}'], path: url.split('/').filter(Boolean) },
    },
    response: [],
  };
  if (body) r.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2) };
  if (auth === false) r.request.auth = { type: 'noauth' };
  if (tests) r.event = [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }];
  return r;
}

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = {
  name: '1. Auth',
  item: [
    req('Register', 'POST', '/auth/register',
      { email: '{{testEmail}}', password: '{{testPassword}}', name: 'Test User' },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 201) {',
        '  pm.environment.set("userId", json.userId);',
        '  pm.test("Registration successful", () => pm.response.to.have.status(201));',
        '}',
      ], false),
    req('Login', 'POST', '/auth/login',
      { email: '{{testEmail}}', password: '{{testPassword}}' },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 200) {',
        '  pm.environment.set("accessToken", json.accessToken);',
        '  pm.environment.set("refreshToken", json.refreshToken);',
        '  pm.test("Login successful", () => pm.response.to.have.status(200));',
        '}',
      ], false),
    req('Verify Email', 'POST', '/auth/verify-email',
      { token: '<paste-token-from-console>' }, null, false),
    req('Resend Verification', 'POST', '/auth/resend-verification',
      { email: '{{testEmail}}' }, null, false),
    req('Refresh Token', 'POST', '/auth/refresh',
      { refreshToken: '{{refreshToken}}' },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 200) {',
        '  pm.environment.set("accessToken", json.accessToken);',
        '  pm.environment.set("refreshToken", json.refreshToken);',
        '}',
      ], false),
    req('Logout', 'POST', '/auth/logout',
      { refreshToken: '{{refreshToken}}' }),
    req('Password Reset Request', 'POST', '/auth/password-reset/request',
      { email: '{{testEmail}}' }, null, false),
    req('Password Reset Confirm', 'POST', '/auth/password-reset/confirm',
      { token: '<paste-token-from-console>', newPassword: 'NewPass456' }, null, false),
  ],
};

// ─── Groups ──────────────────────────────────────────────────────────────────
const groups = {
  name: '2. Groups',
  item: [
    req('Create Group', 'POST', '/groups',
      { name: 'Weekend Warriors', description: 'Hiking group', sportType: 'hiking' },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 201) {',
        '  pm.environment.set("groupId", json.id);',
        '  pm.test("Group created", () => pm.response.to.have.status(201));',
        '}',
      ]),
    req('List My Groups', 'GET', '/groups'),
    req('Get Group Details', 'GET', '/groups/{{groupId}}'),
    req('Update Group', 'PATCH', '/groups/{{groupId}}',
      { name: 'Weekend Warriors Pro', description: 'Advanced hiking' }),
    req('List Members', 'GET', '/groups/{{groupId}}/members'),
    req('Update Member Role', 'PATCH', '/groups/{{groupId}}/members/{{memberId}}',
      { role: 'ADMIN' }),
    req('Remove Member', 'DELETE', '/groups/{{groupId}}/members/{{memberId}}'),
    req('Leave Group', 'POST', '/groups/{{groupId}}/leave'),
    req('Delete Group', 'DELETE', '/groups/{{groupId}}'),
  ],
};

// ─── Invitations ─────────────────────────────────────────────────────────────
const invitations = {
  name: '3. Invitations',
  item: [
    req('Create Invitation', 'POST', '/groups/{{groupId}}/invitations',
      { expiresInHours: 72, maxUses: 10 },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 201) {',
        '  pm.environment.set("invitationToken", json.token);',
        '}',
      ]),
    req('Get Invitation Info', 'GET', '/invitations/{{invitationToken}}/info'),
    req('Join Group via Invitation', 'POST', '/invitations/{{invitationToken}}/join'),
    req('List Active Invitations', 'GET', '/groups/{{groupId}}/invitations'),
    req('Revoke Invitation', 'DELETE', '/groups/{{groupId}}/invitations/<invitation-id>'),
  ],
};

// ─── Sport Profiles ──────────────────────────────────────────────────────────
const sportProfiles = {
  name: '4. Sport Profiles',
  item: [
    req('Create Sport Profile', 'POST', '/sport-profiles',
      { name: 'Mountain Hiking', activityTypes: ['TRAINING', 'CASUAL'] },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 201) {',
        '  pm.environment.set("sportProfileId", json.id);',
        '}',
      ]),
    req('List Sport Profiles', 'GET', '/sport-profiles'),
    req('Get Sport Profile', 'GET', '/sport-profiles/{{sportProfileId}}'),
    req('Update Sport Profile', 'PATCH', '/sport-profiles/{{sportProfileId}}',
      { name: 'Alpine Hiking', activityTypes: ['TRAINING', 'COMPETITION', 'CASUAL'] }),
    req('Delete Sport Profile', 'DELETE', '/sport-profiles/{{sportProfileId}}'),
  ],
};

// ─── Checklists ──────────────────────────────────────────────────────────────
const checklists = {
  name: '5. Checklists',
  item: [
    req('Create Checklist', 'POST', '/checklists',
      { sportProfileId: '{{sportProfileId}}', name: 'Day Hike Essentials', activityType: 'CASUAL' },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 201) {',
        '  pm.environment.set("checklistId", json.id);',
        '}',
      ]),
    req('List Checklists', 'GET', '/checklists'),
    req('List Checklists (filtered)', 'GET', '/checklists?sportProfileId={{sportProfileId}}&activityType=CASUAL'),
    req('Get Checklist', 'GET', '/checklists/{{checklistId}}'),
    req('Update Checklist', 'PATCH', '/checklists/{{checklistId}}',
      { name: 'Updated Day Hike' }),
    req('Duplicate Checklist', 'POST', '/checklists/{{checklistId}}/duplicate'),
    req('Save as Template', 'POST', '/checklists/{{checklistId}}/save-as-template'),
    req('Delete Checklist', 'DELETE', '/checklists/{{checklistId}}'),
  ],
};

// ─── Equipment Items ─────────────────────────────────────────────────────────
const equipmentItems = {
  name: '6. Equipment Items',
  item: [
    req('Add Item', 'POST', '/checklists/{{checklistId}}/items',
      { name: 'Water bottle', quantity: 2, category: 'Hydration', isMandatory: true, sortOrder: 1 },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 201) {',
        '  pm.environment.set("itemId", json.id);',
        '}',
      ]),
    req('Update Item', 'PATCH', '/checklists/{{checklistId}}/items/{{itemId}}',
      { name: 'Water bottle (1L)', quantity: 1 }),
    req('Reorder Items', 'PATCH', '/checklists/{{checklistId}}/items/reorder',
      { itemIds: ['{{itemId}}'] }),
    req('Delete Item', 'DELETE', '/checklists/{{checklistId}}/items/{{itemId}}'),
  ],
};

// ─── Group Activities ────────────────────────────────────────────────────────
const groupActivities = {
  name: '7. Group Activities',
  item: [
    req('Create Activity', 'POST', '/groups/{{groupId}}/activities',
      { name: 'Saturday Morning Hike', activityType: 'CASUAL', sportProfileId: '{{sportProfileId}}', date: '2026-08-01T08:00:00Z' },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 201) {',
        '  pm.environment.set("activityId", json.id);',
        '}',
      ]),
    req('List Activities', 'GET', '/groups/{{groupId}}/activities'),
    req('Get Activity', 'GET', '/groups/{{groupId}}/activities/{{activityId}}'),
  ],
};

// ─── Shared Items ────────────────────────────────────────────────────────────
const sharedItems = {
  name: '8. Shared Items',
  item: [
    req('Add Shared Item', 'POST', '/activities/{{activityId}}/shared-items',
      { name: 'First aid kit', requiredQuantity: 2, category: 'Safety', isMandatory: true },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 201) {',
        '  pm.environment.set("sharedItemId", json.id);',
        '}',
      ]),
    req('List Shared Items', 'GET', '/activities/{{activityId}}/shared-items'),
    req('Update Shared Item', 'PATCH', '/activities/{{activityId}}/shared-items/{{sharedItemId}}',
      { requiredQuantity: 3 }),
    req('Delete Shared Item', 'DELETE', '/activities/{{activityId}}/shared-items/{{sharedItemId}}'),
  ],
};

// ─── Responsibilities ────────────────────────────────────────────────────────
const responsibilities = {
  name: '9. Shared Responsibilities',
  item: [
    req('Claim Responsibility', 'POST', '/shared-items/{{sharedItemId}}/claim',
      { quantity: 1 }),
    req('Pack Responsibility', 'POST', '/shared-items/{{sharedItemId}}/pack',
      { quantity: 1 }),
    req('Add Extra', 'POST', '/shared-items/{{sharedItemId}}/extra',
      { quantity: 1 }),
    req('Release Responsibility', 'POST', '/shared-items/{{sharedItemId}}/release'),
    req('Report Missing', 'POST', '/shared-items/{{sharedItemId}}/report-missing',
      { reason: 'FORGOT' }),
    req('Take Over', 'POST', '/shared-items/{{sharedItemId}}/take-over',
      { quantity: 1 }),
    req('Transfer Responsibility', 'POST', '/shared-items/{{sharedItemId}}/transfer',
      { targetUserId: '<user-id>', quantity: 1 }),
    req('Get Coverage', 'GET', '/shared-items/{{sharedItemId}}/coverage'),
  ],
};

// ─── Packing Sessions ────────────────────────────────────────────────────────
const packingSessions = {
  name: '10. Packing Sessions',
  item: [
    req('Start Session', 'POST', '/packing-sessions',
      { checklistId: '{{checklistId}}', groupActivityId: '{{activityId}}' },
      [
        'const json = pm.response.json();',
        'if (pm.response.code === 201) {',
        '  pm.environment.set("sessionId", json.id);',
        '}',
      ]),
    req('List Sessions', 'GET', '/packing-sessions'),
    req('List Sessions (filtered)', 'GET', '/packing-sessions?status=IN_PROGRESS'),
    req('Get Session', 'GET', '/packing-sessions/{{sessionId}}'),
    req('Record Decision (PACKED)', 'POST', '/packing-sessions/{{sessionId}}/decisions',
      { equipmentItemId: '{{itemId}}', decision: 'PACKED' }),
    req('Record Decision (NOT_PACKED)', 'POST', '/packing-sessions/{{sessionId}}/decisions',
      { equipmentItemId: '{{itemId}}', decision: 'NOT_PACKED', reason: 'FORGOT', notes: 'Left at home' }),
    req('Record Decision (Shared Item)', 'POST', '/packing-sessions/{{sessionId}}/decisions',
      { sharedItemId: '{{sharedItemId}}', decision: 'PACKED' }),
    req('Get Remaining Items', 'GET', '/packing-sessions/{{sessionId}}/remaining'),
    req('Complete Session', 'POST', '/packing-sessions/{{sessionId}}/complete'),
    req('Abandon Session', 'POST', '/packing-sessions/{{sessionId}}/abandon'),
  ],
};

// ─── Readiness ───────────────────────────────────────────────────────────────
const readiness = {
  name: '11. Readiness',
  item: [
    req('Group Readiness', 'GET', '/activities/{{activityId}}/readiness'),
    req('Personal Readiness', 'GET', '/packing-sessions/{{sessionId}}/readiness'),
  ],
};

// ─── Notifications ───────────────────────────────────────────────────────────
const notifications = {
  name: '12. Notifications',
  item: [
    req('List Notifications', 'GET', '/notifications?page=1&limit=20'),
    req('Mark as Read', 'PATCH', '/notifications/{{notificationId}}/read'),
    req('Mark All as Read', 'PATCH', '/notifications/read-all'),
  ],
};

// ─── Health ──────────────────────────────────────────────────────────────────
const health = {
  name: '13. Health',
  item: [
    req('Health Check', 'GET', '/health', null, null, false),
  ],
};

// ─── Assemble ────────────────────────────────────────────────────────────────
const collection = {
  info: {
    name: 'PackPlay API',
    _postman_id: 'packplay-api-collection',
    description: 'Complete API collection for PackPlay (GearGuardian) backend.\nImport along with PackPlay.postman_environment.json.\nSee POSTMAN.md for testing instructions.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
  },
  item: [
    auth, groups, invitations, sportProfiles, checklists, equipmentItems,
    groupActivities, sharedItems, responsibilities, packingSessions,
    readiness, notifications, health,
  ],
};

const outPath = path.join(__dirname, 'PackPlay.postman_collection.json');
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2));
console.log(`✓ Collection written to ${outPath}`);
