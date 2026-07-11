# PackPlay Jenkins and Google Cloud

## Purpose

This setup intentionally has two CI paths:

- Every feature-branch or pull-request commit runs unit tests.
- A commit on `main` runs unit tests plus lint, builds, integration tests, and end-to-end tests.

Jenkins results are informational. Do not configure the Jenkins status as a required GitHub merge check. This keeps merges available when time is limited while still making failures visible.

The setup also demonstrates beginner-friendly Jenkins capabilities: a multibranch pipeline, conditional stages, timeouts, build retention, timestamps, JUnit reports, archived coverage, post-build actions, configuration as code, and reproducible plugins.

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

`test`, `lint`, and `build` are required. Integration and end-to-end targets run when projects define them; Jenkins logs an explicit skip while those targets are not yet present. Unit-test projects can emit JUnit XML under `test-results/` for Jenkins test trends. Coverage under a `coverage/` directory is archived.

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
terraform init
terraform fmt -check
terraform validate
terraform plan -out=jenkins.tfplan
terraform apply jenkins.tfplan
terraform output
```

Terraform creates a dedicated VPC, firewall rules, static IP, service account, and Debian VM. SSH defaults to Google IAP's TCP-forwarding range. HTTPS is public because GitHub users and browsers must reach Jenkins; Jenkins itself requires login.

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

Replace the inventory values with Terraform's IP, your OS Login username, domain, and administrator email. Ensure the domain's A record resolves to the static IP before provisioning; Caddy cannot obtain a publicly trusted certificate until DNS is correct and ports 80/443 are reachable.

Run:

```bash
ansible-playbook playbooks/jenkins.yml
```

The playbook asks for the Jenkins admin password without echoing or storing it in Git. Caddy obtains and renews the ACME certificate automatically. Certificate state and Jenkins state live in Docker volumes and survive container replacement.

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
5. Enable branch discovery and pull-request discovery. Build PR heads (not the speculative merge commit) so PR commits follow the unit-test-only rule.
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

- Back up the `jenkins-home` and `caddy-data` volumes before VM replacement.
- Patch by rerunning Terraform and Ansible; do not hand-edit generated server files.
- Jenkins has one executor to avoid overlapping builds on the starter VM.
- The Docker socket is deliberately not mounted. Current Nx builds run directly in the Jenkins image. If integration tests later require Docker, use a dedicated agent rather than granting the controller root-equivalent socket access.
- The VM service account has no project roles. Add only narrowly scoped roles when a real deployment stage requires them.
- Terraform state can contain sensitive infrastructure data; use a protected Google Cloud Storage backend before collaborating with multiple operators.
