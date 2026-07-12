# PackPlay CI/CD

## Purpose

PackPlay uses a Jenkins Multibranch Pipeline defined in `Jenkinsfile` on the `infrastructure` branch. Jenkins discovers branches and origin pull requests, then chooses the lightweight commit pipeline or the full `main` pipeline from `BRANCH_NAME`.

The Jenkins result is informational and is not configured as a required GitHub merge check.

## Runtime architecture

- The Jenkins controller runs scheduling, UI, credentials, and pipeline coordination with zero build executors.
- A dedicated SSH-connected `packplay-agent` runs repository commands.
- Isolated MySQL and Redis containers provide CI dependencies.
- Caddy terminates HTTPS and renews the Jenkins certificate.
- Jenkins Configuration as Code defines the controller, agent, credentials, security realm, and authorization.
- Build history, timestamps, JUnit reports, and coverage artifacts provide beginner-friendly Jenkins visibility.

## Every branch commit and origin pull request

Each discovered revision goes through:

1. **Checkout** — checks out the exact SCM revision that triggered the multibranch job.
2. **Install** — enables Corepack and runs `npm ci --no-audit --no-fund`.
3. **Generate Prisma client** — generates the typed Prisma client required by compilation and tests.
4. **Unit tests** — runs every Nx test target with coverage and JUnit output.
5. **Post actions** — publishes JUnit XML, archives coverage, prints the result, and deletes the workspace.

`disableConcurrentBuilds()` queues commits for the same branch instead of aborting an older build, so every commit receives a unit-test result.

## Additional jobs on `main`

After the common unit-test stages pass, `main` proceeds through:

1. **Verify full-pipeline contract** — requires at least one Nx project for each `openapi`, `integration`, and `e2e` target.
2. **Lint** — runs every Nx lint target.
3. **Build** — compiles every Nx build target.
4. **Prisma schema** — validates the schema and applies it to the disposable CI MySQL database.
5. **OpenAPI schema** — runs the required OpenAPI-generation/validation target.
6. **Integration tests** — runs tests that exercise application components with CI services.
7. **End-to-end tests** — runs complete external application flows.
8. **Post actions** — records results and cleans the workspace.

## Current pipeline gap

The application defines `build`, `serve`, `test`, `lint`, and `openapi`. It does not yet define `integration` or `e2e`, so the full `main` pipeline intentionally fails at **Verify full-pipeline contract**. This is preferable to reporting unit/lint/build checks alone as a successful full pipeline.

The targets should eventually provide:

- `integration`: test Prisma/MySQL, Redis, authentication, invitation, responsibility, and notification behavior against isolated services;
- `e2e`: test complete HTTP and Socket.IO user flows from outside the application process.

The existing `openapi` target bootstraps application metadata without opening a network port or requiring MySQL/Redis, then regenerates the root `openapi.json` contract.

## Jenkins job discovery

The recommended Multibranch Pipeline configuration is:

- discover branches, excluding branches already represented by pull requests;
- discover origin pull requests using the current PR revision;
- do not discover fork pull requests;
- use `Jenkinsfile` as the script path;
- use a webhook, with a five-minute periodic scan as fallback.

This avoids duplicate branch/PR builds and prevents untrusted public forks from executing arbitrary code on the self-hosted agent.

## Failure handling

- A failed stage stops subsequent dependent stages.
- Unit-test XML is published even when tests fail.
- Coverage is archived when available.
- A 30-minute pipeline timeout prevents stuck builds.
- Jenkins retains the latest 20 builds and up to 10 artifact-bearing builds.
- The workspace is deleted after every result.

Inspect the failed stage and console log in Jenkins. Because the status is informational, maintainers may still merge when time constraints justify it, but the failure remains visible and should be followed up.

## Deployment boundary

The current pipeline performs continuous integration, not automatic application deployment. Terraform and Ansible provision Jenkins and its GCP host through an explicit, reviewed operator workflow. This avoids allowing an ordinary application commit to mutate infrastructure or production state.

Deployment instructions are in [SETUP.md](SETUP.md) and, after the infrastructure branch is merged, the detailed `INFRA_SETUP.md` checklist.
