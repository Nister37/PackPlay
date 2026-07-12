# PackPlay Jenkins and Google Cloud

## Purpose

This setup intentionally has two CI paths:

- Every feature-branch or pull-request commit runs unit tests.
- A commit on `main` runs unit tests plus lint, builds, integration tests, and end-to-end tests.

Jenkins results are informational. Do not configure the Jenkins status as a required GitHub merge check. This keeps merges available when time is limited while still making failures visible.

The setup also demonstrates beginner-friendly Jenkins capabilities: a multibranch pipeline, conditional stages, timeouts, build retention, timestamps, JUnit reports, archived coverage, post-build actions, a dedicated build agent, configuration as code, and reproducible plugins.

## Prerequisites

- A Google Cloud project with billing enabled
- Terraform 1.7 or newer
- Google Cloud CLI authenticated with permission to manage Compute Engine, VPC, service accounts, and optionally Cloud DNS
- Ansible on Linux, macOS, or WSL (Ansible does not run natively as a Windows control node)
- A domain whose DNS can point to the Jenkins static IP
- Repository access credentials if PackPlay is private

Terraform enables the Compute Engine, IAM, and Cloud DNS APIs. On a brand-new project, the Service Usage API may need this one-time bootstrap command before Terraform can manage the others:

```bash
gcloud services enable serviceusage.googleapis.com
```

## Pipeline contract

The root `Jenkinsfile` runs these Nx targets:

```text
test
lint
build
integration
e2e
```

`test` runs for every discovered commit. On `main`, `lint`, `build`, `openapi`, `integration`, and `e2e` are required. The pipeline fails its contract stage instead of silently skipping a missing full-pipeline target. Unit-test projects emit JUnit XML under `test-results/` for Jenkins test trends. Coverage under a `coverage/` directory is archived.

## Operator setup

The exact project, identity, billing, DNS, state-backend, certificate, GitHub credential, and live verification steps are maintained in the root [`INFRA_SETUP.md`](../INFRA_SETUP.md). Those steps require the infrastructure owner's hand and are intentionally not guessed or executed by repository automation.

## Create the infrastructure

All infrastructure changes belong on the `infrastructure` branch.

```bash
git switch infrastructure
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Set the real Google Cloud project and Jenkins domain in `terraform.tfvars`. If the domain uses an existing Cloud DNS zone, set `dns_managed_zone`; otherwise leave it `null` and create the displayed A record with your DNS provider.

Review before applying:

```bash
terraform init -backend-config="bucket=YOUR_STATE_BUCKET_NAME"
terraform fmt -check
terraform validate
terraform plan -out=jenkins.tfplan
terraform apply jenkins.tfplan
terraform output
```

Terraform creates a dedicated VPC, flow-logged subnet, firewall rules, static IP, least-privilege service account, retained boot disk, snapshot schedule, IAM access, and Debian VM. SSH defaults to Google IAP's TCP-forwarding range. HTTPS is public because GitHub users and browsers must reach Jenkins; Jenkins itself requires login.

If using IAP, connect with:

```bash
gcloud compute ssh packplay-jenkins --zone=europe-central2-a --tunnel-through-iap
```

## Configure Jenkins and TLS

Install the Ansible collection and prepare inventory:

```bash
cd infra/ansible
ansible-galaxy collection install -r requirements.yml
cp inventory.example.yml inventory.yml
```

Replace the inventory values with the confirmed project, zone, OS Login username, domain, and administrator email. The inventory routes SSH through IAP. Ensure the domain's A record resolves to the static IP before provisioning; Caddy cannot obtain a publicly trusted certificate until DNS is correct and ports 80/443 are reachable.

Run:

```bash
ansible-playbook playbooks/jenkins.yml
```

The playbook asks for the Jenkins admin password without echoing it and stores it in a root-only Docker secret file. Caddy obtains and renews the ACME certificate automatically. Certificate state and Jenkins state live in Docker volumes and survive container replacement; the retained disk and snapshot schedule protect them from ordinary VM replacement.

Verify:

```bash
curl -I https://jenkins.example.com/login
openssl s_client -connect jenkins.example.com:443 -servername jenkins.example.com </dev/null
```

Use the real domain in both commands.

## Create the multibranch job

1. Sign in with user `admin` and the password supplied to Ansible.
2. Select **New Item**, name it `packplay-ci`, and choose **Multibranch Pipeline**.
3. Add a **GitHub** branch source for `Nister37/PackPlay`.
4. For a private repository, add a read-only fine-grained GitHub token as a Jenkins username/password credential.
5. Discover branches with **Exclude branches that are also filed as PRs**, discover origin PR heads, and disable fork discovery. This avoids duplicate builds and prevents untrusted public-fork execution.
6. Use a webhook when Jenkins is publicly reachable. As a simpler fallback, enable periodic scanning every five minutes.
7. Save and run **Scan Multibranch Pipeline Now**.

Do not add the Jenkins context to GitHub's required status checks. A failed check may still be shown on a pull request, but it must remain non-blocking per the team decision.

## Learning exercises

Try these safely after the first successful build:

1. Break one unit test and observe the stage, JUnit history, and console timestamp.
2. Push the same fix to a feature branch and confirm the full-pipeline stage is skipped.
3. Merge to `main` and compare the extra stages in Stage View.
4. Use **Replay** on a disposable build to experiment without committing; then put useful changes back in the `Jenkinsfile`.
5. Open **Manage Jenkins → System Configuration → Configuration as Code** to see the loaded YAML source.

## Operations and limitations

- Verify the daily disk snapshots and periodically test a restore; a listed snapshot is not proof of recoverability.
- Patch by rerunning Terraform and Ansible; do not hand-edit generated server files.
- Jenkins has one executor on a dedicated build-agent container to avoid overlapping builds on the starter VM. The controller has zero executors, so repository code cannot read its administrator credential.
- The Docker socket is deliberately not mounted. Current Nx builds run directly in the build-agent image. If integration tests later require Docker, add a narrowly scoped Docker-capable agent rather than granting the controller root-equivalent socket access.
- The VM service account has no project roles. Add only narrowly scoped roles when a real deployment stage requires them.
- Terraform uses a protected, versioned Google Cloud Storage backend bootstrapped by `infra/terraform/bootstrap`.
