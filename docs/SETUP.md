# PackPlay setup and deployment

## Requirements

For local development:

- Git;
- Node.js 22 LTS and npm;
- Docker Engine with Docker Compose v2;
- free local ports `3000`, `3306`, and `6379`.

For the Google Cloud deployment:

- an active Google Cloud project with billing enabled;
- `gcloud`, Terraform, and Ansible installed (use Linux, macOS, or WSL for Ansible);
- a domain whose DNS records you can change;
- Docker on the target VM, installed by the Ansible playbook;
- permission to configure the GitHub repository and Jenkins multibranch job.

## Local setup

Run every command in this guide from the repository root—the directory containing `package.json`, `docker-compose.yml`, and the `prisma` directory. Do not run the commands from inside `docs/`.

Commands that use only `git`, `npm`, `npx`, `node`, or `docker` work unchanged in PowerShell and Bash. Platform-specific examples are labeled explicitly. On Linux, `docker compose` may require `sudo` unless your user has access to the Docker daemon.

Confirm your location before continuing (replace the example path with your clone location):

| Windows (PowerShell)                                                     | Linux (Bash)                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `Set-Location C:\path\to\PackPlay`<br>`Test-Path .\prisma\schema.prisma` | `cd /path/to/PackPlay`<br>`test -f prisma/schema.prisma && echo "Repository root found"` |

PowerShell must return `True`; Bash must print `Repository root found`. If your terminal is currently in the `docs` directory, return to the repository root with `Set-Location ..` on Windows or `cd ..` on Linux.

### 1. Clone and install dependencies

```console
git clone https://github.com/Nister37/PackPlay.git
cd PackPlay
npm ci
```

### 2. Configure the environment

Create `.env` in the repository root. It is ignored by Git.

Generate a cryptographically random JWT signing secret. You create this value locally; it does not come from GitHub, Google Cloud, or another provider. This Node.js command works in PowerShell, Command Prompt, Bash, and most terminals:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

Alternatively, with OpenSSL:

```bash
openssl rand -base64 64
```

Copy the generated output into `JWT_SECRET` below without adding quotes or spaces:

```dotenv
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:4200

DATABASE_URL=mysql://packplay:packplay_secret@localhost:3306/packplay
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=packplay
MYSQL_USER=packplay
MYSQL_PASSWORD=packplay_secret
MYSQL_PORT=3306

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_secret
REDIS_DB=0

JWT_SECRET=paste-the-generated-value-here
JWT_ACCESS_EXPIRATION=15m
```

`JWT_SECRET` and `DATABASE_URL` are required by the application. The other values match the local Compose defaults. Do not reuse these development credentials in a deployed environment.

Keep the secret out of Git, screenshots, logs, and shared messages. Generate a different value for each environment. Changing `JWT_SECRET` invalidates previously issued access tokens. In production, store it in a secret manager or root-only Docker secret rather than a committed file or Terraform variable.

### 3. Start MySQL and Redis

The local MySQL initialization script grants the default `packplay` development user permission to create and remove Prisma shadow databases. MySQL runs this script automatically when it initializes a new `mysql_data` volume. This broad grant is intended only for the local Compose environment; do not use it for a deployed database.

```bash
npm run docker:up
docker compose ps
```

Wait until both services report healthy.

If `mysql_data` was created before the initialization script was added and `npx prisma migrate dev` reports error `P3014`, recreate the local volumes once:

```console
npm run docker:down -- -v
npm run docker:up
```

> [!WARNING]
> The `-v` option permanently deletes the local MySQL and Redis data stored in Compose volumes. Do not run it when that local data must be preserved.

### 4. Prepare the database

Confirm again that the Prisma schema is visible from the current directory:

| Windows (PowerShell)                                                     | Linux (Bash)                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `Set-Location C:\path\to\PackPlay`<br>`Test-Path .\prisma\schema.prisma` | `cd /path/to/PackPlay`<br>`test -f prisma/schema.prisma` |

The PowerShell check must return `True`; the Bash check must exit successfully.

```bash
npm run prisma:generate
npx prisma migrate dev
```

If the branch contains no applicable migration history yet, use the following only for local development:

```bash
npx prisma db push
```

`db push` synchronizes a development database but is not a replacement for reviewed production migrations.

If you deliberately need to invoke Prisma from another directory, provide the schema explicitly—for example, from `docs/`:

| Windows (PowerShell)                                                                                               | Linux (Bash)                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `npx prisma migrate dev --schema ..\prisma\schema.prisma`<br>`npx prisma db push --schema ..\prisma\schema.prisma` | `npx prisma migrate dev --schema ../prisma/schema.prisma`<br>`npx prisma db push --schema ../prisma/schema.prisma` |

Running from the repository root is preferred because npm, Nx, Compose, Prisma, and relative output paths then share the same working directory.

### 5. Start the API

```bash
npm run start
```

The API listens on `http://localhost:3000`. In development:

- health: `http://localhost:3000/health`;
- Swagger UI: `http://localhost:3000/api/docs`;
- OpenAPI JSON: `http://localhost:3000/api/docs-json`.

### 6. Verify the project

```bash
npm run lint
npm run test
npm run build
```

The API build uses Nx and webpack to bundle workspace-library imports such as `@packplay/common` while preserving the NestJS decorator metadata required at runtime.

Stop local services with:

```bash
npm run docker:down
```

Add `-v` to `docker compose down` only when you intentionally want to delete the local MySQL and Redis volumes.

## Application deployment status

The repository does not currently contain an automated deployment target for the PackPlay API. The available Terraform and Ansible code deploys the Jenkins CI host, agent, CI databases, and TLS proxy—not the NestJS application as a production service. A production API deployment still needs a reviewed runtime design, production MySQL/Redis services, secret storage, migrations, health checks, rollback, and DNS/TLS routing.

Do not describe a successful Jenkins installation as a deployed PackPlay application.

## Jenkins infrastructure deployment to Google Cloud

The deployment configuration is maintained on the `infrastructure` branch. Merge that branch before running these commands. The detailed operator checklist is then available as `INFRA_SETUP.md`; the sequence below is its concise deployment path.

Run the Ansible portions from Linux or WSL. The `gcloud` and Terraform commands also work in PowerShell, but use the PowerShell copy and line-continuation examples below when not running Bash.

### 1. Authenticate and choose the project

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable serviceusage.googleapis.com
```

Confirm the project ID, Jenkins hostname, DNS zone, administrator identity, and administrator email before applying infrastructure.

### 2. Bootstrap protected Terraform state

| Windows (PowerShell)                                                                                      | Linux/WSL (Bash)                                                                                   |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Copy-Item infra/terraform/bootstrap/terraform.tfvars.example infra/terraform/bootstrap/terraform.tfvars` | `cp infra/terraform/bootstrap/terraform.tfvars.example infra/terraform/bootstrap/terraform.tfvars` |

Set `project_id` and a globally unique `state_bucket_name`, then run:

```bash
terraform -chdir=infra/terraform/bootstrap init
terraform -chdir=infra/terraform/bootstrap validate
terraform -chdir=infra/terraform/bootstrap plan -out=bootstrap.tfplan
terraform -chdir=infra/terraform/bootstrap apply bootstrap.tfplan
```

### 3. Provision the GCP resources

| Windows (PowerShell)                                                                  | Linux/WSL (Bash)                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `Copy-Item infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars` | `cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars` |

Set the confirmed project, Jenkins domain, DNS managed zone (or `null`), and IAM operator members. Then initialize the remote state with the syntax for your shell:

| Windows (PowerShell)                                                                                 | Linux/WSL (Bash)                                                                                     |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `terraform -chdir=infra/terraform init -reconfigure -backend-config="bucket=YOUR_STATE_BUCKET_NAME"` | `terraform -chdir=infra/terraform init -reconfigure -backend-config="bucket=YOUR_STATE_BUCKET_NAME"` |

Review and apply the plan; these commands are identical on both platforms:

```console
terraform -chdir=infra/terraform fmt -check
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform plan -out=jenkins.tfplan
terraform -chdir=infra/terraform apply jenkins.tfplan
terraform -chdir=infra/terraform output
```

Terraform creates the VPC, IAP-restricted SSH access, static public web address, protected VM/disk, DNS record when configured, and scheduled snapshots.

### 4. Configure DNS

If DNS is external to Google Cloud, create an A record from the Jenkins hostname to:

```bash
terraform -chdir=infra/terraform output -raw jenkins_ip
```

Wait for authoritative DNS resolution before starting repeated certificate requests.

### 5. Provision Jenkins through IAP

```bash
ansible-galaxy collection install -r infra/ansible/requirements.yml
cp infra/ansible/inventory.example.yml infra/ansible/inventory.yml
gcloud compute os-login describe-profile --format='value(posixAccounts[0].username)'
```

When using WSL with a repository cloned on Windows, first change to its mounted path (for example, `cd /mnt/c/path/to/PackPlay`). Keep the inventory file and all Ansible commands inside that same WSL session.

Fill in the project, zone, OS Login username, Jenkins domain, and administrator email in the ignored inventory file. Verify access and run the playbook:

```bash
ansible -i infra/ansible/inventory.yml jenkins -m ping
ansible-playbook -i infra/ansible/inventory.yml infra/ansible/playbooks/jenkins.yml
```

Enter a unique Jenkins password at the hidden prompt. Ansible writes it as a root-only Docker secret. Caddy obtains and renews TLS after DNS and ports 80/443 are working.

### 6. Configure Jenkins and verify TLS

Create the `packplay-ci` Multibranch Pipeline using the repository `Nister37/PackPlay`, script path `Jenkinsfile`, origin pull-request discovery, fork discovery disabled, and a five-minute fallback scan. Keep its status informational rather than required for merging.

| Windows (PowerShell)                                                    | Linux/WSL (Bash)                               |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| `Invoke-WebRequest -Method Head -Uri https://YOUR_JENKINS_DOMAIN/login` | `curl -fsSI https://YOUR_JENKINS_DOMAIN/login` |

See `INFRA_SETUP.md` on the merged infrastructure branch for the exact GitHub credential permissions, DNS checks, recovery test, and teardown safeguards.

## Troubleshooting

- Prisma reports that it cannot find `schema.prisma`: return to the repository root (`Set-Location ..` in PowerShell or `cd ..` in Bash), verify the schema (`Test-Path .\prisma\schema.prisma` or `test -f prisma/schema.prisma`), and rerun the command.
- Prisma Migrate reports `P3014` or cannot create its shadow database: the MySQL volume predates `docker/mysql/init.sql`. If the local data is disposable, recreate the volumes using the commands in step 3. If it must be preserved, grant the development user the required privileges manually instead of deleting the volume.
- `PrismaClient` is missing: run `npm run prisma:generate`.
- MySQL connection fails: check `docker compose ps` and ensure `DATABASE_URL` uses the same credentials as Compose.
- Redis authentication fails: make `REDIS_PASSWORD` match the Compose value.
- The API refuses to start: ensure `JWT_SECRET` is present.
- Swagger returns 404: set `NODE_ENV` to a value other than `production` and restart the API.
- Jenkins main build stops at the contract check: implement the missing `integration` and `e2e` Nx targets described in [CICD.md](CICD.md). The `openapi` target is already available through `npm run openapi`.
