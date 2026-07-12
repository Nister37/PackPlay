# Jenkins Homelab Deployment — Adjustment Guide

> **This file is NOT committed.** It's a personal reference for deploying the PackPlay Jenkins CI on your homelab, adapting from the CatSOS setup.

---

## Overview of differences

| Aspect | CatSOS (assumed) | PackPlay |
|--------|---------|----------|
| Runtime | Node.js | Node.js 22 |
| Build tool | npm / Nx (or similar) | npm + Nx 20 |
| ORM/DB | — | Prisma + MySQL 8 |
| Cache | — | Redis 7 |
| Agent label | `catsos-agent` (or similar) | `packplay-agent` |
| Pipeline file | `Jenkinsfile` | `Jenkinsfile` (on `infrastructure` branch) |
| CI databases | maybe none | MySQL + Redis (tmpfs for speed) |
| TLS proxy | Caddy | Caddy (same) |

---

## Step-by-step adjustments

### 1. Clone the `infrastructure` branch content

The Jenkins infra lives on the `infrastructure` branch. Either:

```bash
# Option A: Merge infrastructure into main
git checkout main
git merge infrastructure --no-edit
git push origin main

# Option B: Just extract the jenkins/ folder
git checkout infrastructure -- jenkins/ Jenkinsfile infra/
```

After this, you'll have:
- `jenkins/` — Docker Compose, Dockerfiles, Caddy, CASC
- `Jenkinsfile` — pipeline definition
- `infra/` — Terraform/Ansible (skip for homelab — you deploy manually)

---

### 2. Adjust `jenkins/docker-compose.yml`

The compose file is ready to use as-is, but for homelab you need to:

#### a) Create the `.env` file in `jenkins/`

```dotenv
JENKINS_DOMAIN=jenkins.yourhomelab.local   # or your real domain
JENKINS_ADMIN_EMAIL=your@email.com
```

#### b) If you're reusing the same machine as CatSOS

You can either:
- **Run both** by putting PackPlay Jenkins on different ports (change Caddy ports)
- **Replace** by stopping CatSOS Jenkins and reusing the same ports 80/443

If running both, change the Caddy ports in `docker-compose.yml`:
```yaml
  caddy:
    ports:
      - "8080:80"     # or any free port
      - "8443:443"
```

Or better — use your existing Caddy/Nginx reverse proxy on the homelab and just expose Jenkins on port 8080 internally.

#### c) Homelab without a public domain (no ACME)

If your homelab isn't publicly accessible, replace the Caddyfile with a self-signed or internal CA setup:

```
{
    auto_https off
}

:8080 {
    reverse_proxy jenkins:8080
}
```

Or use your existing reverse proxy (Traefik, Nginx Proxy Manager, etc.) and remove the `caddy` service entirely.

---

### 3. Adjust `jenkins/casc/jenkins.yaml`

Key changes from CatSOS:

#### Agent label
```yaml
nodes:
  - permanent:
      name: "packplay-agent"
      labelString: "packplay-agent linux node nx"
```

If you want to reuse one agent for both CatSOS and PackPlay, give it both labels:
```yaml
labelString: "catsos-agent packplay-agent linux node nx"
```

#### System message (cosmetic)
```yaml
jenkins:
  systemMessage: "PackPlay Jenkins - homelab"
```

#### URL
The `JENKINS_URL` env var is set in docker-compose. Make sure it matches your homelab URL:
```yaml
unclassified:
  location:
    url: "${JENKINS_URL}"
```

---

### 4. Generate SSH keys for the agent

If you don't already have them from CatSOS, or want separate keys:

```bash
mkdir -p jenkins/secrets
ssh-keygen -t ed25519 -f jenkins/secrets/agent_ssh_key -N "" -C "packplay-agent"
```

If reusing CatSOS agent keys, just symlink or copy them:
```bash
cp /path/to/catsos/jenkins/secrets/agent_ssh_key jenkins/secrets/
cp /path/to/catsos/jenkins/secrets/agent_ssh_key.pub jenkins/secrets/
```

---

### 5. Set the admin password

```bash
# Generate a strong password
openssl rand -base64 32 > jenkins/secrets/jenkins_admin_password
```

Or reuse your CatSOS admin password file.

---

### 6. Build and start

```bash
cd jenkins
docker compose up -d --build
docker compose ps   # Wait until all healthy
docker compose logs -f jenkins  # Watch startup
```

---

### 7. Create the Multibranch Pipeline job

In Jenkins UI (`https://jenkins.yourhomelab.local`):

1. **New Item** → name: `packplay-ci` → type: **Multibranch Pipeline**
2. **Branch Sources** → Add → **GitHub**:
   - Repository: `Nister37/PackPlay`
   - Credentials: create a GitHub PAT with `repo` scope
   - Behaviors:
     - Discover branches (exclude branches that are also PRs)
     - Discover pull requests from origin (current revision)
     - Do NOT discover fork PRs
3. **Build Configuration**:
   - Script Path: `Jenkinsfile`
4. **Scan Multibranch Pipeline Triggers**:
   - Periodically: 5 minutes (webhook preferred if you have one)
5. **Save** → Scan now

---

### 8. Webhook (optional, if publicly reachable)

If your homelab is behind a tunnel (Cloudflare, ngrok, Tailscale Funnel):

GitHub repo → Settings → Webhooks → Add:
- URL: `https://jenkins.yourdomain.com/github-webhook/`
- Content type: `application/json`
- Events: Just push + pull request

---

### 9. Verify the pipeline

After the scan discovers `main`:
- The pipeline should checkout, install, generate Prisma, run unit tests
- On `main`, it will hit **"Verify full-pipeline contract"** and intentionally fail because `integration` and `e2e` Nx targets aren't wired yet

This is expected. The unit-test stages will pass.

To make the full pipeline pass, add these targets to `apps/api/project.json`:
```json
{
  "targets": {
    "integration": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx jest --config apps/api/test/jest-integration.config.ts --runInBand --forceExit"
      },
      "configurations": {
        "ci": {}
      }
    },
    "e2e": {
      "executor": "nx:run-commands",
      "options": {
        "command": "echo 'E2E tests not yet implemented'"
      },
      "configurations": {
        "ci": {}
      }
    }
  }
}
```

---

### 10. Key differences from CatSOS to remember

| What | Adjustment needed |
|------|------------------|
| Agent needs Node 22 | Already in the Dockerfile (`node:22-bookworm-slim`) |
| CI needs MySQL + Redis | Both are in `docker-compose.yml` as `mysql-ci` and `redis-ci` with tmpfs |
| Pipeline env vars | `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` are in Jenkinsfile |
| Prisma generate | Required before tests — already a pipeline stage |
| `corepack enable` | Required for npm — already in Install stage |
| Agent label in Jenkinsfile | Must match `packplay-agent` in CASC |

---

## Quick reference: File locations

```
jenkins/
├── Caddyfile                 # Reverse proxy config
├── Dockerfile                # Jenkins controller (with Node.js + plugins)
├── agent/
│   ├── Dockerfile            # Build agent (with Node.js + SSH)
│   └── entrypoint.sh        # Agent startup script
├── casc/
│   └── jenkins.yaml          # Configuration as Code (agent, creds, security)
├── docker-compose.yml        # All services: jenkins, agent, mysql-ci, redis-ci, caddy
├── plugins.txt               # Jenkins plugins to install
└── secrets/                  # NOT committed — you create these
    ├── agent_ssh_key         # Ed25519 private key
    ├── agent_ssh_key.pub     # Public key (injected into agent)
    └── jenkins_admin_password # Plain text password file
```

---

## Troubleshooting

- **Agent offline**: Check `docker compose logs agent` — SSH must be running. Verify key matches.
- **MySQL connection refused in pipeline**: The agent container must be on the `ci` network. Check `docker compose ps` shows `mysql-ci` healthy.
- **Prisma migrate fails in CI**: The CI uses `db push --skip-generate --accept-data-loss` (disposable tmpfs DB). This is correct for CI.
- **Caddy TLS error**: If homelab-only, switch to the `auto_https off` config above.
- **Jenkins stuck at "Jenkins is getting ready"**: Wait for plugin installation. Check `docker compose logs jenkins`.
- **Permission denied on secrets**: Ensure files exist and are readable by the containers.
