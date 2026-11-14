# PackPlay Architecture & System Design

This document details the architectural boundaries, domain flows, realtime mechanisms, and data models of PackPlay.

---

## 1. Monorepo Structure

PackPlay is structured as an **Nx monorepo** separating concerns between backend, frontend, and shared contracts:

```text
PackPlay/
├── apps/
│   ├── api/             # NestJS 11 backend (REST API, WebSockets, Prisma ORM)
│   └── web/             # React 18 + Vite frontend (Tailwind CSS, Three.js 3D Viewer)
├── libs/
│   └── common/          # Shared contracts, domain events, error hierarchy
├── prisma/              # MySQL relational database schema and migration history
├── docker/              # Local MySQL initialization scripts
└── docs/                # In-depth setup, OpenAPI, and security guides
```

---

## 2. Domain & Application Architecture

The backend follows modular domain-driven design principles centered on group readiness and equipment logistics:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Auth & SSO     │ ────> │  Group Context  │ ────> │ Activity Log    │
│  (JWT / OAuth)  │       │  & Memberships  │       │ & Notifications │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                   │
                                   ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Weather Rules   │ ────> │ Shared & Team   │ <──── │ Packing Session │
│ & Open-Meteo    │       │ Equipment Items │       │ & Live Takeover │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

- **Authentication & Authorization**: Stateless JWT access and refresh tokens, bcrypt password hashing, and optional Google OpenID Connect SSO. Guard decorators enforce role-based access (`OWNER`, `ADMIN`, `MEMBER`).
- **Group & Activity Isolation**: Multi-tenant isolation ensuring members can only view and modify items within their groups.
- **Shared Responsibility**: Tracks individual item quotas vs group shared pools, calculating coverage readiness metrics before events.
- **Realtime Gateway**: Socket.IO room fan-out for live packing session takeover, instant item checkoffs, and alert badges.
- **Event Bus & Domain Events**: In-memory decoupled event bus for triggering notification dispatches and readiness recalculations.

---

## 3. Data Storage & Caching Layer

- **MySQL 8.0**: ACID-compliant persistence managed via Prisma ORM for users, groups, checklists, equipment items, and activities.
- **Redis 7**: High-performance key-value caching for session locks, active packing takeover state, weather cache, and pub/sub signaling.

---

## 4. Frontend Architecture

The web client (`apps/web`) is built with:
- **React 18 & Vite**: Fast HMR and lightweight bundle.
- **Tailwind CSS & Lucide Icons**: Responsive UI designed for mobile and desktop usage in the field.
- **Three.js / WebGL Canvas**: Interactive 3D item viewer and packing visualizations.
- **Optimistic UI Updates**: Instant checkbox toggling with Socket.IO synchronization and fallback recovery.
- **Vitest & Testing Library**: Unit and component testing coverage.

---

## 5. Security & Isolation Controls

- Strict input validation via `class-validator` and `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
- Helmet security headers, CORS origin allowlists, and explicit JSON payload limits (1MB).
- No sensitive keys or tokens logged or returned in public API payloads.
- Calendar feed URLs and SSO states are AES-encrypted at rest and in transit.
