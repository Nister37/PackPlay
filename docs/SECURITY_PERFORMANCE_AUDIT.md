# PackPlay (GearGuardian) — Security & Performance Audit Report

**Date:** 2026-07-12  
**Scope:** Full backend (`apps/api/`, `prisma/schema.prisma`, `docker-compose.yml`, `package.json`)  
**Severity Scale:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low | ✅ Good Practice Noted

---

## Executive Summary

The PackPlay backend demonstrates solid foundations: proper token hashing, session rotation, rate limiting, RBAC guards, and safe ORM usage. However, several issues must be addressed before production deployment, particularly around WebSocket CORS, JWT secret handling, missing security headers, and a critical N+1 query in the readiness endpoint.

**Counts:** 🔴 1 | 🟠 6 | 🟡 8 | 🔵 4 | ✅ 12

---

## Part 1: Security Audit

### ✅ Things Done Well

| Area | Detail |
|------|--------|
| Token storage | All tokens (refresh, verification, reset, invitation) are SHA-256 hashed before DB storage — never stored in plaintext |
| Password hashing | bcrypt with 10 rounds (adequate for most workloads) |
| Token rotation | Refresh token rotation on every use — old session immediately revoked |
| Session revocation | Password reset revokes all active sessions |
| User enumeration | Registration, reset, and verification endpoints use constant-time responses to avoid leaking user existence |
| Input validation | `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` strips unknown fields |
| RBAC | Guards enforce group membership and role-based access (`OWNER`, `ADMIN`, `MEMBER`) |
| Rate limiting | Global throttler (30/min) plus stricter per-endpoint limits on auth routes (5/min) |
| SQL injection | Zero risk — all queries via Prisma ORM parameterized queries |
| Error codes | Structured error responses with app-specific codes; no raw DB/stack errors leak |
| Secrets in git | `.gitignore` correctly excludes `.env`, `.env.local`, `.env.*.local` |
| WebSocket auth | JWT verified on connection; unauthenticated clients immediately disconnected |

---

### 🟠 SEC-1: WebSocket CORS Set to `*` (High)

**File:** `apps/api/src/realtime/packing.gateway.ts:18`

```typescript
@WebSocketGateway({
  cors: { origin: '*' },  // ← Allows any origin
  namespace: '/packing',
})
```

**Risk:** Any website can connect to the WebSocket and interact with authenticated users' data via CSRF-like attacks if tokens are extractable.

**Fix:**
```typescript
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  },
  namespace: '/packing',
})
```

Or inject `ConfigService`:
```typescript
// In realtime.module.ts, use a factory for WebSocket options
```

---

### 🟠 SEC-2: JWT Secret Has Hardcoded Fallback (High)

**Files:** `auth.module.ts:20`, `jwt.strategy.ts:14`, `packing.gateway.ts:34`

```typescript
secret: configService.get<string>('JWT_SECRET', 'change-me-in-production'),
```

**Risk:** If `JWT_SECRET` env var is unset (misconfiguration, container issue), the app silently uses a known secret. An attacker who discovers this can forge tokens.

**Fix — fail-fast on startup:**
```typescript
const secret = configService.get<string>('JWT_SECRET');
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

Apply the same pattern in `JwtStrategy` and `PackingGateway`.

---

### 🟠 SEC-3: No Helmet Middleware — Missing Security Headers (High)

**File:** `apps/api/src/main.ts`

The application sets no HTTP security headers. Missing:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `X-XSS-Protection`
- `Content-Security-Policy`

**Fix:**
```bash
npm install helmet
```
```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  // ...
}
```

---

### 🟠 SEC-4: Swagger Exposed in Production (High)

**File:** `apps/api/src/main.ts:27-31`

API docs are always available at `/api/docs` regardless of environment.

**Fix:**
```typescript
if (configService.get('NODE_ENV') !== 'production') {
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
}
```

---

### 🟡 SEC-5: No Password Complexity Validation (Medium)

**File:** `apps/api/src/auth/dto/register.dto.ts`

Only `@MinLength(8)` and `@MaxLength(128)`. Passwords like `aaaaaaaa` or `12345678` pass validation.

**Fix — add `@Matches` for basic complexity:**
```typescript
import { Matches } from 'class-validator';

@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
  message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
})
password!: string;
```

---

### 🟡 SEC-6: Refresh Token in Response Body (Medium)

**File:** `auth.service.ts` → `createSession()` returns `{ accessToken, refreshToken }`

Tokens are returned in the JSON body. While acceptable for mobile/SPA apps, this means JavaScript code has access to the refresh token, making it vulnerable to XSS.

**Recommendation for web clients:** Set refresh token as an `httpOnly`, `Secure`, `SameSite=Strict` cookie. Maintain body-based flow for mobile clients via a flag/header.

---

### 🟡 SEC-7: Invitation Token in URL Path (Medium)

**File:** `invitations.controller.ts`

```
GET /invitations/:token/info
POST /invitations/:token/join
```

Tokens in URL paths are logged in server access logs, proxy logs, and browser history.

**Recommendation:** Accept the token in the request body instead:
```
POST /invitations/join  { "token": "..." }
GET  /invitations/info  { "token": "..." }  (or use query param with short TTL)
```

---

### 🟡 SEC-8: `enableImplicitConversion` Allows Type Coercion Abuse (Medium)

**File:** `apps/api/src/main.ts:24`

```typescript
transformOptions: { enableImplicitConversion: true }
```

Combined with `@Query('page') page?: number` in `notifications.controller.ts`, values like `?page=NaN`, `?page=-5`, `?limit=999999` pass through. Prisma will handle NaN gracefully (error), but large `limit` values can cause performance issues.

**Fix — add explicit validation in the DTO or controller:**
```typescript
@IsOptional()
@IsInt()
@Min(1)
page?: number;

@IsOptional()
@IsInt()
@Min(1)
@Max(100)
limit?: number;
```

Or create a `PaginationQueryDto` and use it.

---

### 🟡 SEC-9: No CSRF Protection (Medium)

If refresh tokens are ever moved to cookies (SEC-6), CSRF attacks become possible. Currently low-risk since tokens are in request bodies.

**Fix when adding cookie-based auth:**
```bash
npm install csurf
# or use NestJS's built-in CSRF guard
```

---

### 🔵 SEC-10: `resendVerification` Leaks Verified Status (Low)

**File:** `auth.service.ts:83-86`

```typescript
if (user.emailVerified) {
  throw new BadRequestException({ ... 'Email is already verified' });
}
```

This reveals whether an email exists AND is verified. The `register` endpoint already returns 409 for existing emails, so this is a minor additional vector.

**Fix:** Return the same generic response for both cases:
```typescript
if (!user || user.emailVerified) return; // Silent
```

---

### 🔵 SEC-11: No Token Cleanup / Expired Token Pruning (Low)

Used/expired tokens accumulate in `email_verification_tokens`, `password_reset_tokens`, and `sessions` tables indefinitely.

**Fix:** Add a scheduled job (cron) to clean up:
```typescript
@Cron('0 3 * * *') // Daily at 3 AM
async pruneExpiredTokens() {
  await this.prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }] }
  });
  // Similar for other token tables
}
```

---

### 🔵 SEC-12: `any` Type in Where Clause (Low)

**File:** `packing-sessions.service.ts:50`

```typescript
const where: any = { userId };
```

While not directly exploitable (Prisma validates input), this bypasses TypeScript's type safety and could mask errors in future changes.

**Fix:**
```typescript
import { Prisma } from '@prisma/client';
const where: Prisma.PackingSessionWhereInput = { userId };
```

---

### 🔵 SEC-13: Console Logging in Production (Low)

**File:** `main.ts:36-37`

```typescript
console.log(`Application is running on: http://localhost:${port}`);
console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
```

Use NestJS `Logger` instead for structured output.

---

## Part 2: Performance Review

### 🔴 PERF-1: Critical N+1 Query in `getGroupReadiness()` (Critical)

**File:** `apps/api/src/readiness/readiness.service.ts:79-130`

```typescript
for (const member of activity.group.members) {
  const sessions = await this.prisma.packingSession.findMany({
    where: { userId: member.userId, groupActivityId: activityId },
    include: { checklist: { include: { items: ... } }, decisions: ... },
    take: 1,
  });
  // ...
}
```

A group with 20 members = 20 separate DB queries. This is the hottest path in the app (called on every readiness check and after every packing event).

**Fix — single query with aggregation:**
```typescript
async getGroupReadiness(activityId: string): Promise<GroupReadiness> {
  const activity = await this.prisma.groupActivity.findUnique({
    where: { id: activityId },
    include: {
      sharedItems: { include: { responsibilities: true } },
      group: {
        include: {
          members: { include: { user: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  if (!activity) throw new NotFoundException(...);

  // Fetch latest session per member in ONE query
  const latestSessions = await this.prisma.packingSession.findMany({
    where: {
      groupActivityId: activityId,
      userId: { in: activity.group.members.map(m => m.userId) },
    },
    orderBy: { createdAt: 'desc' },
    distinct: ['userId'],
    include: {
      checklist: {
        include: { items: { where: { isMandatory: true }, select: { id: true } } },
      },
      decisions: {
        where: { equipmentItemId: { not: null } },
        select: { equipmentItemId: true, decision: true },
      },
    },
  });

  const sessionsByUser = new Map(latestSessions.map(s => [s.userId, s]));

  // ... compute memberReadiness from sessionsByUser map
}
```

This reduces N+1 queries to **2 queries** total regardless of group size.

---

### 🟠 PERF-2: Redis Instantiated but Never Used for Caching (High)

**File:** `apps/api/src/common/redis.service.ts`

Redis is connected and available globally but only used for health checks. Hot paths like readiness calculations, shared item coverage, and notification counts have no caching.

**Fix — add caching methods to RedisService:**
```typescript
async get<T>(key: string): Promise<T | null> {
  const data = await this.client.get(key);
  return data ? JSON.parse(data) : null;
}

async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

async invalidate(pattern: string): Promise<void> {
  const keys = await this.client.keys(pattern);
  if (keys.length) await this.client.del(...keys);
}
```

**Priority cache targets:**
1. `getGroupReadiness(activityId)` — TTL 30s, invalidate on packing events
2. `listSharedItems(activityId)` — TTL 60s, invalidate on claim/release/pack
3. `notifications.count(userId, isRead: false)` — TTL 10s

---

### 🟠 PERF-3: Batch Notification Creation Missing (High)

**File:** `packing-sessions.service.ts:195-208`

```typescript
for (const member of otherMembers) {
  await this.notificationsService.createNotification({ ... });
}
```

If a group has 50 members, this creates 49 sequential INSERT queries.

**Fix — add `createMany` method:**
```typescript
async createNotificationsBatch(inputs: CreateNotificationInput[]) {
  return this.prisma.notification.createMany({
    data: inputs.map(input => ({
      userId: input.userId,
      groupId: input.groupId ?? null,
      type: input.type as NotificationType,
      payload: input.payload as any,
    })),
  });
}
```

---

### 🟠 PERF-4: Missing Compound Indexes on `PackingDecision` (High)

**File:** `prisma/schema.prisma`

The dedup check in `recordDecision()` queries:
```typescript
where: { packingSessionId, equipmentItemId }
// and
where: { packingSessionId, sharedItemId }
```

Only `@@index([packingSessionId])` exists — no compound indexes.

**Fix — add to Prisma schema:**
```prisma
model PackingDecision {
  // ...existing fields...

  @@index([packingSessionId])
  @@index([packingSessionId, equipmentItemId])
  @@index([packingSessionId, sharedItemId])
  @@map("packing_decisions")
}
```

---

### 🟡 PERF-5: WebSocket Membership Check Over-fetches (Medium)

**File:** `packing.gateway.ts:57-64`

```typescript
const activity = await this.prisma.groupActivity.findUnique({
  where: { id: data.activityId },
  include: { group: { include: { members: true } } },  // Loads ALL members
});
const isMember = activity.group.members.some((m) => m.userId === userId);
```

Loads all group members just to check if ONE user is a member.

**Fix — direct membership check:**
```typescript
const membership = await this.prisma.groupMember.findFirst({
  where: {
    userId,
    group: { activities: { some: { id: data.activityId } } },
  },
});
if (!membership) return;
await client.join(`activity:${data.activityId}`);
```

---

### 🟡 PERF-6: No Pagination on List Endpoints (Medium)

**Files:** `packing-sessions.service.ts:listSessions()`, `shared-equipment.service.ts:listActivities()`, `shared-equipment.service.ts:listSharedItems()`

These endpoints return all results without pagination. For active groups this can grow unbounded.

**Fix:** Add `take`/`skip` parameters with defaults:
```typescript
async listSessions(userId: string, status?: string, page = 1, limit = 20) {
  return this.prisma.packingSession.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
    // ...
  });
}
```

---

### 🟡 PERF-7: No Connection Pool Configuration (Medium)

**File:** `apps/api/src/common/prisma.service.ts`

Prisma uses default connection pool (5 connections). Under concurrent load this may bottleneck.

**Fix — configure via DATABASE_URL or programmatically:**
```
DATABASE_URL=mysql://user:pass@host:3306/db?connection_limit=20&pool_timeout=10
```

Or use Prisma's `datasourceUrl` option with explicit pool settings.

---

### 🟡 PERF-8: `getGroupReadiness` Eagerly Loads Unused Data (Medium)

The single initial query loads ALL responsibilities for ALL shared items even though only committed+packed statuses are needed for the coverage calculation.

**Fix — filter at the query level:**
```typescript
sharedItems: {
  include: {
    responsibilities: {
      where: {
        status: { in: ['COMMITTED', 'PACKED'] },
      },
      select: { committedQuantity: true },
    },
  },
  select: { requiredQuantity: true, responsibilities: true },
}
```

---

### 🟡 PERF-9: `emitToUser` Iterates All Sockets (Medium)

**File:** `packing.gateway.ts:93-99`

```typescript
for (const [, socket] of sockets.sockets) {
  if (socket.data.userId === userId) { ... }
}
```

Iterates through ALL connected sockets to find one user.

**Fix — maintain a userId→socketId Map:**
```typescript
private userSockets = new Map<string, Set<string>>();

handleConnection(client: Socket) {
  // After auth...
  if (!this.userSockets.has(userId)) {
    this.userSockets.set(userId, new Set());
  }
  this.userSockets.get(userId)!.add(client.id);
}

handleDisconnect(client: Socket) {
  const userId = client.data.userId;
  this.userSockets.get(userId)?.delete(client.id);
}

emitToUser(userId: string, event: string, payload: Record<string, unknown>) {
  const socketIds = this.userSockets.get(userId);
  if (!socketIds) return;
  for (const id of socketIds) {
    this.server.to(id).emit(event, payload);
  }
}
```

---

## Part 3: Dependency & Configuration

### 🟡 DEP-1: Caret Ranges in `package.json` (Medium)

All dependencies use `^` ranges allowing minor version bumps. A compromised or buggy minor release could break production.

**Recommendation for production:** Pin exact versions in `package.json` or use `npm ci` with a locked `package-lock.json` (which already exists). For extra safety:
```bash
npm config set save-exact true
```

---

### 🟡 DEP-2: Docker Compose Fallback Secrets (Medium)

```yaml
MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpassword}
```

If `.env` is missing in a production-like environment, weak defaults are used.

**Fix:** Remove defaults for secrets, or add a docker-compose.prod.yml override without defaults.

---

## Part 4: Prioritized Action Plan

### Immediate (before any public deployment)

| # | Finding | Effort |
|---|---------|--------|
| 1 | SEC-2: Remove JWT secret fallback, fail-fast | 15 min |
| 2 | SEC-1: Fix WebSocket CORS | 10 min |
| 3 | SEC-3: Add Helmet middleware | 10 min |
| 4 | SEC-4: Guard Swagger behind NODE_ENV | 5 min |
| 5 | PERF-4: Add compound indexes (migration) | 20 min |

### Short-term (within sprint)

| # | Finding | Effort |
|---|---------|--------|
| 6 | PERF-1: Fix N+1 in getGroupReadiness | 1-2 hrs |
| 7 | PERF-3: Batch notification creation | 30 min |
| 8 | SEC-5: Add password complexity validation | 15 min |
| 9 | SEC-8: Add pagination DTO validation | 30 min |
| 10 | PERF-5: Fix WebSocket over-fetching | 30 min |

### Medium-term (next 2 sprints)

| # | Finding | Effort |
|---|---------|--------|
| 11 | PERF-2: Implement Redis caching layer | 3-4 hrs |
| 12 | PERF-6: Add pagination to all list endpoints | 2 hrs |
| 13 | PERF-9: User-socket map for efficient emit | 1 hr |
| 14 | SEC-6: httpOnly cookie option for web clients | 2-3 hrs |
| 15 | SEC-11: Scheduled token cleanup | 1 hr |
| 16 | PERF-7: Connection pool tuning | 30 min |

---

## Appendix: Files Reviewed

```
apps/api/src/main.ts
apps/api/src/app.module.ts
apps/api/src/auth/auth.controller.ts
apps/api/src/auth/auth.module.ts
apps/api/src/auth/services/auth.service.ts
apps/api/src/auth/strategies/jwt.strategy.ts
apps/api/src/auth/guards/jwt-auth.guard.ts
apps/api/src/auth/token.util.ts
apps/api/src/auth/dto/register.dto.ts
apps/api/src/common/common.module.ts
apps/api/src/common/prisma.service.ts
apps/api/src/common/redis.service.ts
apps/api/src/groups/groups.controller.ts
apps/api/src/groups/groups.service.ts
apps/api/src/groups/guards/group-member.guard.ts
apps/api/src/groups/guards/group-role.guard.ts
apps/api/src/invitations/invitations.controller.ts
apps/api/src/invitations/invitations.service.ts
apps/api/src/notifications/notifications.controller.ts
apps/api/src/notifications/notifications.service.ts
apps/api/src/packing-sessions/packing-sessions.service.ts
apps/api/src/readiness/readiness.service.ts
apps/api/src/realtime/packing.gateway.ts
apps/api/src/shared-equipment/shared-equipment.service.ts
prisma/schema.prisma
package.json
docker-compose.yml
.env.example
.gitignore
```
