# POSTMAN.md — API Testing Guide

## Quick Start

### 1. Import into Postman

1. Open Postman → **Import** → select both files from the `postman/` folder:
   - `PackPlay.postman_collection.json` — all API requests
   - `PackPlay.postman_environment.json` — environment variables
2. Select the **PackPlay - Local** environment in the top-right dropdown.

### 2. Start the backend

```bash
npm run docker:up       # Start MySQL + Redis
npx prisma migrate dev  # Apply migrations
npm run start           # Start NestJS on port 3000
```

### 3. Run requests in order

The collection is numbered 1–13. Follow the order for the first run to populate IDs automatically via test scripts.

---

## Environment Variables

| Variable | Auto-set by | Description |
|----------|------------|-------------|
| `baseUrl` | Manual | API base URL (default `http://localhost:3000`) |
| `accessToken` | Login | JWT access token (Bearer auth) |
| `refreshToken` | Login | Refresh token for session renewal |
| `userId` | Register | Current user's ID |
| `groupId` | Create Group | Active group ID |
| `invitationToken` | Create Invitation | Token for joining a group |
| `sportProfileId` | Create Sport Profile | Active sport profile ID |
| `checklistId` | Create Checklist | Active checklist ID |
| `itemId` | Add Item | Equipment item ID |
| `activityId` | Create Activity | Group activity ID |
| `sharedItemId` | Add Shared Item | Shared item ID |
| `sessionId` | Start Session | Packing session ID |
| `memberId` | Manual | Target member ID (from List Members) |
| `notificationId` | Manual | Notification ID (from List Notifications) |
| `testEmail` | Manual | Test user email |
| `testPassword` | Manual | Test user password |

---

## Testing Each Endpoint

### 1. Auth (`/auth/*`)

#### Register
```
POST /auth/register
```
- Body: `{ "email": "testuser@example.com", "password": "TestPass123", "name": "Test User" }`
- Expected: `201` with `{ userId }` — auto-saved to environment
- Note: Check console output for the verification token

#### Verify Email
```
POST /auth/verify-email
```
- Body: `{ "token": "<token-from-console-output>" }`
- Expected: `200` with success message
- **How to get the token**: Look at the terminal running `npm run start` — the ConsoleEmailService prints it

#### Resend Verification
```
POST /auth/resend-verification
```
- Body: `{ "email": "testuser@example.com" }`
- Expected: `200` — always returns success (prevents email enumeration)

#### Login
```
POST /auth/login
```
- Body: `{ "email": "testuser@example.com", "password": "TestPass123" }`
- Expected: `200` with `{ accessToken, refreshToken }` — auto-saved
- Must verify email first!

#### Refresh Token
```
POST /auth/refresh
```
- Body: `{ "refreshToken": "{{refreshToken}}" }`
- Expected: `200` with new token pair (rotated)

#### Logout
```
POST /auth/logout
```
- Body: `{ "refreshToken": "{{refreshToken}}" }`
- Expected: `200` — session revoked
- Requires: Bearer token in header

#### Password Reset Request
```
POST /auth/password-reset/request
```
- Body: `{ "email": "testuser@example.com" }`
- Expected: `200` — check console for reset token

#### Password Reset Confirm
```
POST /auth/password-reset/confirm
```
- Body: `{ "token": "<from-console>", "newPassword": "NewPass456" }`
- Expected: `200` — all sessions revoked

---

### 2. Groups (`/groups/*`)

All group endpoints require Bearer auth.

#### Create Group
```
POST /groups
```
- Body: `{ "name": "Weekend Warriors", "description": "Hiking group", "sportType": "hiking" }`
- Expected: `201` — group ID auto-saved

#### List My Groups
```
GET /groups
```
- Expected: `200` — array of groups with role and memberCount

#### Get Group Details
```
GET /groups/{{groupId}}
```
- Expected: `200` — group with members list
- Requires: membership in the group

#### Update Group
```
PATCH /groups/{{groupId}}
```
- Body: `{ "name": "New Name" }` (partial update)
- Expected: `200`
- Requires: OWNER or ADMIN role

#### List Members
```
GET /groups/{{groupId}}/members
```
- Expected: `200` — array of members with roles
- Note: Copy a `memberId` from the response for role/remove tests

#### Update Member Role
```
PATCH /groups/{{groupId}}/members/{{memberId}}
```
- Body: `{ "role": "ADMIN" }` (ADMIN or MEMBER)
- Requires: OWNER role

#### Remove Member
```
DELETE /groups/{{groupId}}/members/{{memberId}}
```
- Expected: `204`
- Requires: OWNER or ADMIN role
- Cannot remove the OWNER

#### Leave Group
```
POST /groups/{{groupId}}/leave
```
- Expected: `204`
- Cannot leave as sole OWNER

#### Delete Group
```
DELETE /groups/{{groupId}}
```
- Expected: `204`
- Requires: OWNER role

---

### 3. Invitations (`/invitations/*`)

#### Create Invitation
```
POST /groups/{{groupId}}/invitations
```
- Body: `{ "expiresInHours": 72, "maxUses": 10 }`
- Expected: `201` with `{ id, token, expiresAt, maxUses }`
- Requires: OWNER or ADMIN
- Token auto-saved to environment

#### Get Invitation Info
```
GET /invitations/{{invitationToken}}/info
```
- Expected: `200` with `{ groupName, sportType, memberCount }`
- Use this to preview before joining

#### Join Group
```
POST /invitations/{{invitationToken}}/join
```
- Expected: `201` — creates membership
- Test with a DIFFERENT user (register a second account)

#### List Active Invitations
```
GET /groups/{{groupId}}/invitations
```
- Expected: `200` — array of active (non-revoked, non-expired) invitations
- Requires: OWNER or ADMIN

#### Revoke Invitation
```
DELETE /groups/{{groupId}}/invitations/<invitation-id>
```
- Expected: `204`
- Replace `<invitation-id>` with the `id` from Create Invitation response



---

### 4. Sport Profiles (`/sport-profiles/*`)

#### Create Sport Profile
```
POST /sport-profiles
```
- Body: `{ "name": "Mountain Hiking", "activityTypes": ["TRAINING", "CASUAL"] }`
- Expected: `201` — profile ID auto-saved
- Valid activityTypes: `TRAINING`, `COMPETITION`, `CASUAL`, `TRAVEL`

#### List Sport Profiles
```
GET /sport-profiles
```
- Expected: `200` — array of user's profiles

#### Get Sport Profile
```
GET /sport-profiles/{{sportProfileId}}
```
- Expected: `200` — profile details

#### Update Sport Profile
```
PATCH /sport-profiles/{{sportProfileId}}
```
- Body: `{ "name": "Alpine Hiking", "activityTypes": ["TRAINING", "COMPETITION", "CASUAL"] }`
- Expected: `200`

#### Delete Sport Profile
```
DELETE /sport-profiles/{{sportProfileId}}
```
- Expected: `204` — also deletes associated checklists (cascade)

---

### 5. Checklists (`/checklists/*`)

#### Create Checklist
```
POST /checklists
```
- Body: `{ "sportProfileId": "{{sportProfileId}}", "name": "Day Hike Essentials", "activityType": "CASUAL" }`
- Expected: `201` — ID auto-saved

#### List Checklists
```
GET /checklists
GET /checklists?sportProfileId={{sportProfileId}}&activityType=CASUAL
```
- Expected: `200` — supports optional filters

#### Get Checklist (with items)
```
GET /checklists/{{checklistId}}
```
- Expected: `200` — includes nested `items` array

#### Update Checklist
```
PATCH /checklists/{{checklistId}}
```
- Body: `{ "name": "Updated Name" }`
- Expected: `200`

#### Duplicate Checklist
```
POST /checklists/{{checklistId}}/duplicate
```
- Expected: `201` — new checklist with same items

#### Save as Template
```
POST /checklists/{{checklistId}}/save-as-template
```
- Expected: `200` — sets `isTemplate: true`

#### Delete Checklist
```
DELETE /checklists/{{checklistId}}
```
- Expected: `204`

---

### 6. Equipment Items (`/checklists/:checklistId/items/*`)

#### Add Item
```
POST /checklists/{{checklistId}}/items
```
- Body:
```json
{
  "name": "Water bottle",
  "quantity": 2,
  "category": "Hydration",
  "isMandatory": true,
  "notes": "At least 1L each",
  "sortOrder": 1
}
```
- Expected: `201` — item ID auto-saved

#### Update Item
```
PATCH /checklists/{{checklistId}}/items/{{itemId}}
```
- Body: `{ "name": "Water bottle (1L)", "quantity": 1 }`
- Expected: `200`

#### Reorder Items
```
PATCH /checklists/{{checklistId}}/items/reorder
```
- Body: `{ "itemIds": ["<id1>", "<id2>", "<id3>"] }`
- Expected: `200` — updates sortOrder values

#### Delete Item
```
DELETE /checklists/{{checklistId}}/items/{{itemId}}
```
- Expected: `204`

---

### 7. Group Activities (`/groups/:groupId/activities/*`)

Requires group membership.

#### Create Activity
```
POST /groups/{{groupId}}/activities
```
- Body:
```json
{
  "name": "Saturday Morning Hike",
  "activityType": "CASUAL",
  "sportProfileId": "{{sportProfileId}}",
  "date": "2026-08-01T08:00:00Z"
}
```
- Expected: `201` — activity ID auto-saved

#### List Activities
```
GET /groups/{{groupId}}/activities
```
- Expected: `200` — includes `_count.sharedItems`

#### Get Activity (with shared items)
```
GET /groups/{{groupId}}/activities/{{activityId}}
```
- Expected: `200` — includes shared items with responsibilities

---

### 8. Shared Items (`/activities/:activityId/shared-items/*`)

#### Add Shared Item
```
POST /activities/{{activityId}}/shared-items
```
- Body:
```json
{
  "name": "First aid kit",
  "requiredQuantity": 2,
  "category": "Safety",
  "isMandatory": true,
  "notes": "Include bandages and antiseptic"
}
```
- Expected: `201` — shared item ID auto-saved

#### List Shared Items (with coverage)
```
GET /activities/{{activityId}}/shared-items
```
- Expected: `200` — each item includes `coverage` object with status

#### Update Shared Item
```
PATCH /activities/{{activityId}}/shared-items/{{sharedItemId}}
```
- Body: `{ "requiredQuantity": 3, "notes": "Updated notes" }`
- Expected: `200`

#### Delete Shared Item
```
DELETE /activities/{{activityId}}/shared-items/{{sharedItemId}}
```
- Expected: `204`



---

### 9. Shared Responsibilities (`/shared-items/:itemId/*`)

These model the lifecycle of who brings what.

#### Claim Responsibility
```
POST /shared-items/{{sharedItemId}}/claim
```
- Body: `{ "quantity": 1 }`
- Expected: `201` — you are now responsible for 1 unit
- Fails if already claimed or would exceed required quantity

#### Pack Responsibility
```
POST /shared-items/{{sharedItemId}}/pack
```
- Body: `{ "quantity": 1 }` (optional — defaults to committed quantity)
- Expected: `200` — status becomes PACKED

#### Add Extra
```
POST /shared-items/{{sharedItemId}}/extra
```
- Body: `{ "quantity": 1 }`
- Expected: `200` — increments extraQuantity

#### Release Responsibility
```
POST /shared-items/{{sharedItemId}}/release
```
- No body required
- Expected: `200` — status becomes RELEASED
- Cannot release if already PACKED

#### Report Missing
```
POST /shared-items/{{sharedItemId}}/report-missing
```
- Body: `{ "reason": "FORGOT" }`
- Valid reasons: `FORGOT`, `COULD_NOT_BRING`, `REPLACEMENT_ARRANGED`
- Expected: `200` — notifies group members

#### Take Over
```
POST /shared-items/{{sharedItemId}}/take-over
```
- Body: `{ "quantity": 1 }`
- Expected: `200/201` — takes over from a missing item
- Requires: at least one responsibility with FORGOT/COULD_NOT_BRING status
- Use a DIFFERENT user than the one who reported missing

#### Transfer Responsibility
```
POST /shared-items/{{sharedItemId}}/transfer
```
- Body: `{ "targetUserId": "<other-user-id>", "quantity": 1 }`
- Expected: `200/201` — releases yours, creates for target
- Target must be a group member

#### Get Coverage
```
GET /shared-items/{{sharedItemId}}/coverage
```
- Expected: `200` with:
```json
{
  "requiredQuantity": 2,
  "committedQuantity": 1,
  "packedQuantity": 0,
  "extraQuantity": 0,
  "uncoveredQuantity": 1,
  "status": "PARTIALLY_COVERED"
}
```

---

### 10. Packing Sessions (`/packing-sessions/*`)

#### Start Session
```
POST /packing-sessions
```
- Body: `{ "checklistId": "{{checklistId}}", "groupActivityId": "{{activityId}}" }`
- `groupActivityId` is optional (for personal packing without a group event)
- Expected: `201` — session ID auto-saved

#### List Sessions
```
GET /packing-sessions
GET /packing-sessions?status=IN_PROGRESS
```
- Valid statuses: `IN_PROGRESS`, `COMPLETED`, `ABANDONED`
- Expected: `200`

#### Get Session (with decisions)
```
GET /packing-sessions/{{sessionId}}
```
- Expected: `200` — includes all decisions with item details

#### Record Decision — PACKED
```
POST /packing-sessions/{{sessionId}}/decisions
```
- Body: `{ "equipmentItemId": "{{itemId}}", "decision": "PACKED" }`
- Expected: `201`

#### Record Decision — NOT_PACKED (requires reason)
```
POST /packing-sessions/{{sessionId}}/decisions
```
- Body:
```json
{
  "equipmentItemId": "{{itemId}}",
  "decision": "NOT_PACKED",
  "reason": "FORGOT",
  "notes": "Left it at home"
}
```
- Valid decisions: `PACKED`, `NOT_PACKED`, `SKIPPED`
- Valid reasons: `FORGOT`, `COULD_NOT_BRING`, `REPLACEMENT_ARRANGED`, `NOT_NEEDED`
- Reason is REQUIRED for `NOT_PACKED`

#### Record Decision — Shared Item
```
POST /packing-sessions/{{sessionId}}/decisions
```
- Body: `{ "sharedItemId": "{{sharedItemId}}", "decision": "PACKED" }`
- When a shared item is NOT_PACKED with FORGOT/COULD_NOT_BRING, group is notified

#### Get Remaining Items
```
GET /packing-sessions/{{sessionId}}/remaining
```
- Expected: `200` — mandatory items without a decision yet

#### Complete Session
```
POST /packing-sessions/{{sessionId}}/complete
```
- Expected: `200` — fails if mandatory items are unresolved
- Emits `readiness.updated` via WebSocket

#### Abandon Session
```
POST /packing-sessions/{{sessionId}}/abandon
```
- Expected: `200` — marks session as ABANDONED

---

### 11. Readiness (`/activities/:activityId/readiness`, `/packing-sessions/:sessionId/readiness`)

#### Group Readiness
```
GET /activities/{{activityId}}/readiness
```
- Expected: `200` with:
```json
{
  "activityId": "...",
  "totalSharedItems": 5,
  "coveredSharedItems": 3,
  "groupPercentage": 60,
  "memberReadiness": [
    {
      "userId": "...",
      "userName": "Alice",
      "percentage": 75,
      "packedMandatoryItems": 3,
      "totalMandatoryItems": 4
    }
  ]
}
```

#### Personal Readiness
```
GET /packing-sessions/{{sessionId}}/readiness
```
- Expected: `200` with:
```json
{
  "sessionId": "...",
  "totalMandatoryItems": 4,
  "packedMandatoryItems": 3,
  "percentage": 75
}
```

---

### 12. Notifications (`/notifications/*`)

#### List Notifications (paginated)
```
GET /notifications?page=1&limit=20
```
- Expected: `200` with `{ data: [...], meta: { total, page, limit, totalPages } }`

#### Mark as Read
```
PATCH /notifications/{{notificationId}}/read
```
- Expected: `200`
- Get a `notificationId` from the list response

#### Mark All as Read
```
PATCH /notifications/read-all
```
- Expected: `200`

---

### 13. Health (`/health`)

#### Health Check
```
GET /health
```
- No auth required
- Expected: `200` with database and Redis status:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

---

## Testing Tips

### Multi-user testing

To test invitation joining, takeover, and transfer flows:

1. Register User A → verify → login (token saved)
2. Create a group and activity with User A
3. Create an invitation
4. **In a new Postman tab/window** or by changing `testEmail`/`testPassword`:
   - Register User B → verify → login
   - Join group via invitation token
   - Now both users are in the same group

### Testing real-time (WebSocket)

Connect with a Socket.IO client (e.g., `wscat` or Postman's WebSocket tab):

```
URL: ws://localhost:3000/packing
Auth header: Bearer {{accessToken}}
```

Events to listen for:
- `shared-item.missing` — when someone reports a missing item
- `packing.progress-updated` — when a decision is recorded
- `readiness.updated` — when a session is completed

Join rooms:
```json
// Emit: join:activity
{ "activityId": "{{activityId}}" }

// Emit: join:group
{ "groupId": "{{groupId}}" }
```

### Common error codes

| Code | Meaning |
|------|---------|
| `EMAIL_ALREADY_EXISTS` | Registration with existing email |
| `INVALID_CREDENTIALS` | Wrong email/password |
| `EMAIL_NOT_VERIFIED` | Login before verifying email |
| `INVALID_TOKEN` | Expired or wrong token |
| `NOT_A_MEMBER` | Accessing a group you're not in |
| `INSUFFICIENT_ROLE` | Action requires higher role |
| `SHARED_ITEM_ALREADY_COVERED` | Claim exceeds required quantity |
| `ALREADY_CLAIMED` | You already have active responsibility |
| `MANDATORY_ITEMS_UNRESOLVED` | Completing session with unchecked mandatory items |
| `CANNOT_REMOVE_OWNER` | Trying to remove the group owner |

### Rate limits

- Global: 30 requests / minute
- Auth endpoints (register, login, password reset): 5 requests / minute
- If you hit `429 Too Many Requests`, wait 60 seconds

---

## Regenerating the Collection

If you modify endpoints, update `postman/generate-collection.js` and run:

```bash
node postman/generate-collection.js
```

This regenerates `postman/PackPlay.postman_collection.json`.
