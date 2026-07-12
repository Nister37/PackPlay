# PackPlay infrastructure setup

## Purpose

This is the operator checklist for actions that require your Google Cloud identity, billing project, domain ownership, Jenkins administrator password, or GitHub repository permissions. Repository-controlled configuration is kept on the `infrastructure` branch.

Do not run `terraform apply` until you have reviewed the plan and accepted the expected Compute Engine, disk, snapshot, static-IP, DNS, and network costs.

## 1. Choose and authenticate the Google Cloud project

Confirm the intended billable project instead of relying on whichever project happens to be active:

```bash
gcloud auth login
gcloud auth application-default login
gcloud projects list
gcloud config set project YOUR_CONFIRMED_PROJECT_ID
gcloud services enable serviceusage.googleapis.com
```

Record these values before continuing:

- confirmed Google Cloud project ID;
- Jenkins fully qualified domain name, for example `jenkins.your-domain.example`;
- existing Cloud DNS managed-zone name, or confirmation that DNS is hosted elsewhere;
- Google account or group that should administer the VM;
- Jenkins/ACME administrator email.

The operator IAM value must use Google IAM member syntax, for example `user:name@example.com` or `group:platform@example.com`.

## 2. Publish and merge the infrastructure branch

The branch must be available to GitHub before Jenkins can discover its `Jenkinsfile`:

```bash
git switch infrastructure
git fetch origin
git rebase origin/main
git push -u origin infrastructure
```

Open a pull request into `main`. Resolve any new application dependency conflicts and rerun the validation commands from this document before merging.

The `main` pipeline deliberately fails until the application defines all three required Nx targets:

```text
openapi
integration
e2e
```

This prevents a partial lint/build pipeline from being reported as a successful full pipeline.

## 3. Create protected remote Terraform state

Choose a globally unique bucket name. A practical convention is `packplay-tfstate-YOUR_CONFIRMED_PROJECT_ID` because Google Cloud project IDs are globally unique.

```bash
cp infra/terraform/bootstrap/terraform.tfvars.example infra/terraform/bootstrap/terraform.tfvars
```

Set the confirmed project and bucket name, then review and apply only the state bucket:

```bash
terraform -chdir=infra/terraform/bootstrap init
terraform -chdir=infra/terraform/bootstrap fmt -check
terraform -chdir=infra/terraform/bootstrap validate
terraform -chdir=infra/terraform/bootstrap plan -out=bootstrap.tfplan
terraform -chdir=infra/terraform/bootstrap apply bootstrap.tfplan
```

The bootstrap state is local because it creates the backend itself. Store its resulting `terraform.tfstate` securely until the bucket has been verified.

## 4. Configure and apply the main Terraform stack

```bash
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

Set:

- `project_id` to the confirmed project;
- `jenkins_domain` to the real public hostname;
- `dns_managed_zone` to the Cloud DNS zone name, or `null` for external DNS;
- `operator_members` to the approved IAM users/groups.

Initialize the protected backend using the bucket created above:

```bash
terraform -chdir=infra/terraform init \
  -reconfigure \
  -backend-config="bucket=YOUR_STATE_BUCKET_NAME"
terraform -chdir=infra/terraform fmt -check
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform plan -out=jenkins.tfplan
terraform -chdir=infra/terraform apply jenkins.tfplan
terraform -chdir=infra/terraform output
```

Deletion protection is enabled and the boot disk is retained by default. For an intentional teardown, first set `deletion_protection = false`, apply that change, and only then run a reviewed destroy plan.

## 5. Configure DNS

If `dns_managed_zone` names an existing Cloud DNS zone, Terraform creates the A record automatically.

For an external DNS provider, create an A record:

```text
Name: the Jenkins hostname
Type: A
Value: terraform output -raw jenkins_ip
TTL: 300
```

Wait until authoritative DNS resolves to the Terraform output:

```bash
dig +short YOUR_JENKINS_DOMAIN A
terraform -chdir=infra/terraform output -raw jenkins_ip
```

Do not start Caddy repeatedly while DNS is incorrect; repeated failed ACME attempts can encounter certificate-authority rate limits.

## 6. Prepare the IAP-backed Ansible inventory

Install Ansible on Linux, macOS, or WSL and install the pinned collection range:

```bash
ansible-galaxy collection install -r infra/ansible/requirements.yml
cp infra/ansible/inventory.example.yml infra/ansible/inventory.yml
```

Find your OS Login username:

```bash
gcloud compute os-login describe-profile \
  --format='value(posixAccounts[0].username)'
```

In `inventory.yml`, set the confirmed project ID, zone, OS Login username, domain, and administrator email. The included ProxyCommand sends Ansible SSH through IAP; direct public SSH is intentionally blocked.

Verify access before provisioning:

```bash
gcloud compute ssh packplay-jenkins \
  --zone=europe-central2-a \
  --tunnel-through-iap
ansible -i infra/ansible/inventory.yml jenkins -m ping
```

## 7. Provision Jenkins and request the certificate

Run the playbook from the repository root:

```bash
ansible-playbook \
  -i infra/ansible/inventory.yml \
  infra/ansible/playbooks/jenkins.yml
```

Enter a unique Jenkins administrator password at the hidden prompt. Ansible stores it as a root-only Docker secret file; it is not written to `.env` or Git.

Caddy obtains and renews the public certificate automatically after DNS resolves and ports 80/443 reach the VM.

Verify:

```bash
curl -fsSI https://YOUR_JENKINS_DOMAIN/login
openssl s_client \
  -connect YOUR_JENKINS_DOMAIN:443 \
  -servername YOUR_JENKINS_DOMAIN </dev/null
```

## 8. Configure the GitHub multibranch job

Sign in to Jenkins and create a **Multibranch Pipeline** named `packplay-ci`.

Use this branch-source configuration:

- repository: `Nister37/PackPlay`;
- discover branches: **Exclude branches that are also filed as pull requests**;
- discover pull requests from origin: **The current pull request revision**;
- discover pull requests from forks: **disabled**;
- script path: `Jenkinsfile`;
- periodic scan fallback: five minutes.

This produces one unit-test build per feature commit and avoids duplicate branch-plus-PR builds. Fork builds remain disabled because the repository is public.

For visible GitHub commit statuses, create a fine-grained token with only:

- repository metadata: read;
- repository contents: read;
- commit statuses: read and write.

Store it in Jenkins Credentials as a username/password credential. Do not place the token in JCasC, `.env`, Terraform variables, or Git.

If you configure a webhook manually, point GitHub to:

```text
https://YOUR_JENKINS_DOMAIN/github-webhook/
```

Keep Jenkins informational: do not add its status context to GitHub required status checks. GitHub may display a failed Jenkins result, but merging must remain possible.

## 9. Prove the two pipeline paths

Before considering setup complete:

1. Push a feature-branch commit and verify only checkout, install, and unit-test stages run.
2. Push two commits quickly and verify both queue and complete; older builds must not be aborted.
3. Open an origin pull request and confirm Jenkins does not also create a duplicate branch build.
4. Merge to `main` and verify lint, build, Prisma, OpenAPI, integration, and E2E stages all execute.
5. Confirm the Jenkins status is visible but not required for merging.
6. Confirm no fork pull request is executed.

## 10. Verify recovery

Terraform configures daily snapshots with retention. After the first scheduled snapshot:

```bash
gcloud compute snapshots list \
  --filter='labels.application=packplay AND labels.component=jenkins'
```

Document a test restoration to a disposable disk/VM before relying on the backup. Snapshot existence alone does not prove recoverability.

## Limitations

- The VM remains publicly reachable on ports 80/443 so Caddy can serve Jenkins and complete ACME challenges. SSH remains IAP-only.
- The persistent disk uses Google-managed encryption. A customer-supplied key is intentionally not used because losing that operator-held key would make the Jenkins disk and snapshots unrecoverable.
- The low-volume Terraform state bucket relies on Cloud Audit Logs rather than provisioning a second storage access-log bucket. Object versioning, public-access prevention, uniform access, and state locking remain enabled.
- The build agent has no Docker socket. MySQL and Redis are isolated CI sidecars instead of host-level Docker access.
- Application teams must maintain the required `openapi`, `integration`, and `e2e` Nx targets.
- Updating pinned Jenkins plugins or image digests is deliberate maintenance and requires rebuilding and rerunning the smoke tests.

## Application-owner follow-up

These items require an application decision and are intentionally not disguised as infrastructure success:

- Implement the `openapi`, `integration`, and `e2e` Nx targets before expecting `main` to pass. The Jenkins contract check reports each missing target explicitly.
- Plan and test an Nx 20 to Nx 23 upgrade. The current `npm audit` reports eight high-severity advisories in development-only Nx glob dependencies; `npm audit --omit=dev` reports zero vulnerabilities, and the offered automatic remediation is a breaking major-version upgrade. Do not use `npm audit fix --force` without treating it as an application migration.
