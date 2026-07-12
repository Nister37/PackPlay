# OpenAPI and Swagger UI

PackPlay generates its OpenAPI document from NestJS controllers, DTO decorators, and the shared configuration in `apps/api/src/openapi.config.ts`. The interactive documentation is enabled only when `NODE_ENV` is not `production`.

## View the API documentation

Start MySQL, Redis, and the API as described in [SETUP.md](SETUP.md), then open:

```text
http://localhost:3000/api/docs
```

The raw OpenAPI JSON is served at:

```text
http://localhost:3000/api/docs-json
```

The document describes the REST API and its bearer-token authentication scheme. Socket.IO events are not represented by OpenAPI and must be documented separately when their external contract stabilizes.

## Authenticate in Swagger UI

1. Register and verify an account through the authentication endpoints.
2. Call `POST /auth/login`.
3. Copy the returned access token.
4. Select **Authorize** in Swagger UI and enter the bearer token.
5. Call protected endpoints before the short-lived access token expires.

Do not commit real passwords, refresh tokens, access tokens, verification tokens, or reset tokens in examples.

## Generate the contract

Generate the committed contract directly from the application metadata; MySQL and Redis do not need to be running:

```bash
npm run openapi
```

The command writes `openapi.json` at the repository root. The generated document should be treated as an artifact of the annotated source, not edited manually. Update controller decorators and DTO `ApiProperty` metadata, then regenerate it whenever the API contract changes.

## Coverage expectations

Every public REST operation should define:

- a stable route and HTTP method;
- an `ApiTags` group and concise `ApiOperation` summary;
- request DTO property metadata;
- bearer authentication where required;
- important success and error responses;
- path and query parameter metadata when inference is insufficient.

Swagger being available does not prove that every response schema is complete. Review the generated JSON when changing DTOs, pagination, authentication, or error contracts.

## Production behavior

Swagger UI and JSON are disabled in production to avoid publishing an unnecessary discovery surface. If public API documentation is required later, publish a reviewed static OpenAPI artifact separately rather than enabling the development UI on the production API.
