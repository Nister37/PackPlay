# PackPlay

PackPlay is a backend for coordinating personal and shared equipment before a group activity. Users can maintain reusable sport checklists, organize groups, assign quantities of shared equipment, record packing decisions, report missing items, transfer responsibility, and receive readiness and real-time updates.

The repository currently contains the API and its supporting infrastructure. A frontend is not included.

## Main capabilities

- email/password registration, verification, login, token refresh, logout, and password reset;
- groups, memberships, roles, and invitation links;
- sport profiles, reusable checklists, and personal equipment;
- group activities and quantity-based shared-equipment responsibility;
- packing sessions, missing-item reasons, takeover, and readiness summaries;
- in-app notifications and Socket.IO activity/group rooms;
- health checks for MySQL and Redis;
- interactive Swagger API documentation in non-production environments.

## Technology stack

| Area                      | Technology                                          |
| ------------------------- | --------------------------------------------------- |
| Runtime                   | Node.js 22, TypeScript                              |
| Monorepo                  | Nx 20                                               |
| API                       | NestJS 11, REST, Socket.IO                          |
| Validation and API docs   | class-validator, class-transformer, OpenAPI/Swagger |
| Authentication            | Passport, JWT, bcrypt                               |
| Data                      | MySQL 8, Prisma ORM                                 |
| Cache and ephemeral state | Redis 7, ioredis                                    |
| Testing                   | Jest, Supertest-compatible test setup               |
| Local services            | Docker Compose                                      |
| CI/CD                     | Jenkins Multibranch Pipeline                        |
| Infrastructure            | Google Cloud, Terraform, Ansible, Docker, Caddy     |

## Repository layout

```text
apps/api/          NestJS application and domain modules
libs/common/       Shared application errors and utilities
prisma/            MySQL data model
infra/             Terraform and Ansible infrastructure (infrastructure branch)
jenkins/           Jenkins, agent, CI sidecars, and Caddy configuration
```

## Getting started

Follow [SETUP.md](docs/SETUP.md) for local installation and deployment. The generated contract and API documentation instructions are in [openapi.json](openapi.json) and [OPENAPI.md](docs/OPENAPI.md), while the pipeline is described in [CICD.md](docs/CICD.md).

Useful commands:

```bash
npm run start
npm run test
npm run lint
npm run build
```

## Current limitations

- Swagger is deliberately disabled when `NODE_ENV=production`.
- Email delivery currently uses an application abstraction whose development implementation writes messages to the console; connect a transactional provider before production use.
- The infrastructure pipeline requires `openapi`, `integration`, and `e2e` Nx targets on `main`. OpenAPI generation is implemented, but `integration` and `e2e` are still missing, so the contract check intentionally prevents a false-green full pipeline.
- The infrastructure configuration is maintained separately on the `infrastructure` branch and must be merged before the deployment commands are available on `main`.
- Terraform and Ansible currently deploy Jenkins infrastructure only; a production deployment workflow for the NestJS API has not yet been implemented.
