# AGENT.md — Backend Developer

## Mission

Build and maintain the GearGuardian backend as a modular NestJS application inside an Nx monorepo.

The backend must support:

- email/password registration and login,
- email verification,
- password reset,
- SSO login,
- linking an existing account to an SSO provider,
- groups joined through links and QR codes,
- personal and shared equipment lists,
- shared-item responsibility and quantities,
- live notifications when an item is forgotten, released, covered, or taken over,
- packing sessions with explicit missing-item reasons,
- personal and group readiness summaries.

Prioritize working user flows over architectural novelty.

---

## Required stack

- **Runtime:** Node.js LTS
- **Language:** TypeScript with strict mode
- **Monorepo:** Nx
- **Backend:** NestJS
- **Database:** MySQL 8
- **ORM:** Prisma
- **Real-time:** Socket.IO through NestJS gateways
- **Cache and ephemeral state:** Redis
- **Authentication:** Passport, JWT access tokens, refresh-token sessions
- **SSO:** OAuth 2.0 / OpenID Connect
- **Validation:** NestJS ValidationPipe with `class-validator`, or Zod where shared schemas are required
- **Email:** transactional email provider through an abstraction
- **Background jobs:** BullMQ only for delayed or asynchronous work
- **API documentation:** OpenAPI/Swagger
- **Testing:** Jest, Supertest, Playwright-compatible test environment
- **Local infrastructure:** Docker Compose

Do not replace MySQL with PostgreSQL or SQLite.

---

## Architectural rules

Use a modular monolith.

Suggested modules:

```text
apps/api/src/
├── auth/
├── users/
├── identities/
├── groups/
├── invitations/
├── sport-profiles/
├── checklists/
├── equipment-items/
├── shared-responsibilities/
├── packing-sessions/
├── notifications/
├── readiness/
├── email/
├── realtime/
└── common/
```

Keep domain logic in services or domain-focused helpers, not controllers.

Controllers should:

1. validate input,
2. call an application service,
3. map the result,
4. return the response.

Controllers must not contain ownership calculations, readiness calculations, token logic, or multi-step business workflows.

Do not split the system into microservices during the hackathon.

---

## Domain rules

### Item types

Every equipment item is either:

- `PERSONAL`
- `SHARED`

Personal items belong to one user.

Shared items belong to a group activity and may require one or more units.

### Shared-item coverage

A shared item must expose:

- required quantity,
- committed quantity,
- packed quantity,
- extra quantity,
- uncovered quantity,
- responsible members,
- replacement status.

Recommended derived statuses:

```text
UNASSIGNED
PARTIALLY_COVERED
COVERED
PACKED
MISSING
REPLACEMENT_PENDING
REPLACEMENT_FOUND
```

Do not store a derived status as the only source of truth. Derive it from responsibilities and quantities whenever practical.

### Responsibility lifecycle

A user may:

- claim responsibility,
- claim a partial quantity,
- pack their quantity,
- bring extra units,
- release responsibility,
- transfer responsibility,
- report `FORGOT`,
- report `COULD_NOT_BRING`,
- report `REPLACEMENT_ARRANGED`.

A user assigned to an item must not silently leave it unresolved.

When an assigned item is not packed, require an explicit reason.

### Takeover behavior

When a user reports a missing shared item:

1. update the item state transactionally,
2. notify relevant group members,
3. allow another member to take over,
4. update all connected clients,
5. recalculate readiness,
6. prevent double takeover or over-claiming under concurrent requests.

Use database transactions for responsibility transfer and takeover.

### Group invitations

A group may be joined through:

- a shareable link,
- a QR code containing that link.

Invitation tokens must be:

- unguessable,
- revocable,
- optionally expiring,
- tied to one group,
- safe to consume multiple times only when configured as reusable.

The QR code contains the normal invitation URL. Do not build a separate QR-only joining mechanism.

---

## Authentication requirements

### Email/password

Support:

- registration,
- email verification,
- resend verification,
- login,
- logout,
- password reset request,
- password reset completion.

Passwords must be hashed with Argon2id or bcrypt using a suitable work factor.

Never log:

- passwords,
- reset tokens,
- verification tokens,
- access tokens,
- refresh tokens,
- OAuth authorization codes.

### Sessions

Use short-lived access tokens and revocable refresh-token sessions.

Store refresh-token hashes, not plaintext tokens.

A session record should include:

- user ID,
- token hash,
- creation time,
- expiration time,
- last-used time,
- optional user-agent/device metadata,
- revocation time.

### SSO and account linking

Represent login methods separately from users.

Suggested model:

```text
User
Identity
Session
EmailVerificationToken
PasswordResetToken
```

An identity should contain:

- provider,
- provider subject ID,
- provider email,
- linked user ID.

Rules:

- one provider identity belongs to exactly one user,
- the same provider subject cannot be linked twice,
- do not automatically merge accounts only because emails match,
- when an SSO email matches an existing local account, require the user to authenticate the existing account before linking,
- connecting SSO must preserve the same user data and memberships,
- prevent a user from removing their last usable sign-in method.

---

## Database guidance

Use Prisma migrations.

Suggested core entities:

```text
User
Identity
Session
EmailVerificationToken
PasswordResetToken
Group
GroupMember
GroupInvitation
SportProfile
Checklist
EquipmentItem
GroupActivity
SharedItem
SharedResponsibility
PackingSession
PackingDecision
Notification
```

Use MySQL-compatible column types and indexes.

Add indexes for:

- normalized email,
- provider plus provider subject,
- group invitation token hash,
- group membership lookup,
- activity plus item lookup,
- responsibility by user and shared item,
- active sessions by user,
- unread notifications by user.

Use UTC timestamps in the database.

Use soft deletion only where recovery or audit history has clear user value. Do not apply it everywhere.

---

## API conventions

Use REST for persistent resources and Socket.IO for live updates.

Example REST areas:

```text
POST   /auth/register
POST   /auth/verify-email
POST   /auth/login
POST   /auth/password-reset/request
POST   /auth/password-reset/confirm
POST   /auth/sso/:provider
POST   /auth/sso/:provider/link

POST   /groups
GET    /groups/:groupId
POST   /groups/:groupId/invitations
POST   /invitations/:token/join

POST   /activities
POST   /activities/:activityId/shared-items
POST   /shared-items/:itemId/claim
POST   /shared-items/:itemId/release
POST   /shared-items/:itemId/report-missing
POST   /shared-items/:itemId/take-over

POST   /packing-sessions
POST   /packing-sessions/:sessionId/decisions
POST   /packing-sessions/:sessionId/complete
GET    /activities/:activityId/readiness
```

Use consistent error responses:

```json
{
  "code": "SHARED_ITEM_ALREADY_COVERED",
  "message": "The requested quantity is already covered.",
  "details": {}
}
```

Do not expose raw Prisma, MySQL, OAuth, or stack-trace errors.

---

## Real-time contract

Recommended server events:

```text
shared-item.claimed
shared-item.released
shared-item.packed
shared-item.missing
shared-item.takeover-requested
shared-item.takeover-accepted
shared-item.coverage-updated
packing.progress-updated
readiness.updated
notification.created
```

Every event should include:

- event name,
- entity ID,
- group or activity ID,
- version or updated timestamp,
- minimal changed data.

On reconnect, clients must fetch current state rather than relying on missed events.

Socket events are notifications of change, not the authoritative data store.

---

## Concurrency and consistency

Treat these operations as concurrency-sensitive:

- claiming the final uncovered quantity,
- releasing responsibility,
- accepting a takeover,
- transferring responsibility,
- completing a packing session,
- linking an SSO identity.

Use transactions and unique constraints.

Where needed, use optimistic concurrency through an `updatedAt` value or version number.

Two users must not both become the sole replacement for the same missing quantity.

---

## Authorization

Every group-scoped request must verify membership.

Roles may be:

```text
OWNER
ADMIN
MEMBER
```

At minimum:

- only members may view group data,
- only authorized members may remove members,
- only the owner or admin may regenerate invitations,
- a user may update only their own responsibility unless performing an accepted transfer,
- a removed member immediately loses access.

Never rely only on frontend checks.

---

## Testing priorities

### Unit tests

Cover:

- readiness calculation,
- quantity coverage,
- extra-item handling,
- missing-item reasons,
- replacement logic,
- transfer rules,
- SSO linking rules,
- token expiry and one-time use.

### Integration tests

Cover:

- register → verify → login,
- password reset,
- link existing account to SSO,
- join group through invitation,
- partial shared-item coverage,
- missing item → notification → takeover,
- removed member authorization,
- reconnect and state refresh.

### API tests

Use Supertest.

### Real-time tests

Use multiple Socket.IO clients.

Verify:

- all relevant users receive updates,
- unauthorized users cannot join group rooms,
- reconnecting users recover current state,
- duplicate client submissions remain idempotent where required.

---

## Security requirements

- validate all external input,
- rate-limit authentication and invitation endpoints,
- hash all one-time tokens before storage,
- expire verification and reset tokens,
- revoke used reset tokens,
- use secure, HTTP-only cookies where refresh tokens are stored in the browser,
- configure CORS explicitly,
- protect state-changing cookie-authenticated routes against CSRF,
- use environment variables for secrets,
- do not commit secrets,
- sanitize user-generated text before rendering it in email or HTML,
- restrict OAuth redirect URIs,
- verify OAuth `state` and OIDC nonce where applicable.

---

## Logging and observability

Use structured logs.

Include:

- request ID,
- user ID when available,
- group/activity ID when relevant,
- event name,
- outcome,
- latency.

Do not log private token values or full email contents.

Expose:

- health endpoint,
- database readiness,
- Redis readiness.

---

## Definition of done

A backend issue is done when:

- the user-visible behavior works,
- authorization is enforced,
- validation exists,
- errors are mapped to stable application error codes,
- relevant tests pass,
- Swagger documentation is updated,
- no secrets or debug output are committed,
- the flow works against MySQL, not only mocks,
- real-time changes are reflected consistently where applicable.

---

## Priority order

1. Authentication and verified accounts
2. Group creation and joining
3. Shared-item quantities and responsibility
4. Packing-session decisions
5. Missing-item reporting and takeover
6. Real-time notifications
7. Readiness summary
8. SSO linking
9. Secondary polish and optimizations

Do not block core flows on AI features.
