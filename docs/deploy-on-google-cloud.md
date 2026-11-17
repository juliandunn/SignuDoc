# Deploy SignuDoc on Google Cloud

SignuDoc runs on a handful of basic Google Cloud services, all in one project of yours:

| Need                     | Service                                                        |
| ------------------------ | -------------------------------------------------------------- |
| The app                  | **Cloud Run**, from a container image built by **Cloud Build** |
| Image storage            | **Artifact Registry**                                          |
| Postgres                 | **[Neon](https://neon.com)**, outside Google Cloud             |
| Documents (the PDFs)     | **Cloud Storage**, in a private bucket                         |
| Passwords and keys       | **Secret Manager**                                             |
| Daily cleanup and backup | **Cloud Scheduler**, calling the app's two internal routes     |
| Schema changes           | A **Cloud Run job** that runs the migrations on every deploy   |
| Logs                     | **Cloud Logging**, which collects what the app prints          |

Email goes out through [Resend](https://resend.com), which is not part of Google Cloud: Google Cloud blocks outbound mail on port 25, and the app sends over Resend's HTTPS API.

You need a Google Cloud project with billing turned on, the [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) signed in as someone who owns the project, a Neon account, and a Resend API key. It takes about 20 minutes.

The commands below are meant to be run in one terminal session, top to bottom: later ones use the variables set by earlier ones.

## 1. Choose names and turn on the services

```bash
export PROJECT_ID=your-project-id
export REGION=us-central1        # europe-west4, europe-west1 and so on for the EU
export SERVICE=signudoc

gcloud config set project "$PROJECT_ID"
gcloud services enable \
  run.googleapis.com secretmanager.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com

export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
export RUN_SA="signudoc-run@$PROJECT_ID.iam.gserviceaccount.com"
export BUILD_SA="signudoc-build@$PROJECT_ID.iam.gserviceaccount.com"
export BUCKET="$PROJECT_ID-signudoc-files"
```

Use one region for everything. Where your data is kept is the region you pick here; see [Running in the EU](self-hosting.md#running-in-the-eu).

## 2. Service accounts

The app runs as its own service account, which can reach only what it needs. A second one does the building and deploying.

```bash
gcloud iam service-accounts create signudoc-run --display-name="SignuDoc app"
gcloud iam service-accounts create signudoc-build --display-name="SignuDoc build and deploy"

# The builder: push images, deploy, run the migration job, write logs, and
# read the source `gcloud builds submit` uploads.
for role in roles/artifactregistry.writer roles/run.admin \
            roles/logging.logWriter roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$BUILD_SA" --role="$role"
done
# ... and act as the app's account when it deploys a revision that runs as it.
gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" \
  --member="serviceAccount:$BUILD_SA" --role=roles/iam.serviceAccountUser
```

## 3. Database

Google Cloud has no low-cost Postgres that scales down to nothing, so SignuDoc's database stays on [Neon](https://neon.com), which has a free plan and bills small databases by use. Cloud SQL works too: the app only needs a Postgres 15+ connection string, and Cloud Run can reach Cloud SQL with `--set-cloudsql-instances` and a `?host=/cloudsql/<connection name>` URL.

1. In the [Neon console](https://console.neon.tech), create a project. Pick the region closest to your Cloud Run region (an EU region if you will [run in the EU](self-hosting.md#running-in-the-eu)), Postgres 17, and a database named `signudoc`.
2. Open **Connect** and copy two connection strings for that database and role:
   - the **pooled** one, whose host contains `-pooler`. The app uses it.
   - the **direct** one (turn "Connection pooling" off). The migrations use it, because they take a session-level lock and run DDL, which a transaction-mode pooler does not handle reliably.

Both end in `?sslmode=require`; leave that as it is. Keep them to hand for step 5, and do not paste them into a chat, a file in the repository or a shell history you share.

Neon keeps the database's history for a restore window and can restore it to a point in time; the window is longer on paid plans. See [Backup and restore](backup-and-restore.md). Your Cloud Run service reaches Neon over the internet, with TLS and the password in the connection string: there is no network rule to maintain.

The app keeps up to 10 connections per running instance and the service below allows 3 instances, which the pooled endpoint absorbs.

## 4. File bucket

```bash
gcloud storage buckets create "gs://$BUCKET" \
  --location="$REGION" \
  --uniform-bucket-level-access --public-access-prevention

gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$RUN_SA" --role=roles/storage.objectUser
```

The bucket is private and stays private: no document has a public address, and every read goes through the app, which checks who is asking first. New buckets keep deleted and overwritten files for seven days (soft delete), which is the only undo there is, so see [Backup and restore](backup-and-restore.md) before you rely on this for records you must keep.

## 5. Secrets

```bash
# The pooled connection string from step 3 (typed without echo, not on the command line).
read -rs -p 'Pooled Neon URL: ' NEON_POOLED_URL; echo
printf '%s' "$NEON_POOLED_URL" | gcloud secrets create signudoc-database-url --data-file=-
# The direct one, used only by the migration job.
read -rs -p 'Direct Neon URL: ' NEON_DIRECT_URL; echo
printf '%s' "$NEON_DIRECT_URL" | gcloud secrets create signudoc-database-url-direct --data-file=-
unset NEON_POOLED_URL NEON_DIRECT_URL

# Signs sessions. Keep it: changing it signs everyone out.
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create signudoc-auth-secret --data-file=-

# Lets only Cloud Scheduler call the daily cleanup and backup.
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create signudoc-job-secret --data-file=-

# Your Resend API key (re_...).
printf '%s' 're_xxxxxxxx' | gcloud secrets create signudoc-resend-key --data-file=-

for secret in signudoc-database-url signudoc-database-url-direct signudoc-auth-secret \
              signudoc-job-secret signudoc-resend-key; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:$RUN_SA" --role=roles/secretmanager.secretAccessor
done
```

Optional: `printf '%s' "$(openssl rand -hex 16)" | gcloud secrets create signudoc-setup-token --data-file=-` and give the app access the same way, to [lock down the setup page](self-hosting.md#lock-down-a-new-install).

## 6. Create the service and the migration job

Both are created now with Google's sample image, so the real settings are in place before the first build. The build in the next step replaces the image.

```bash
export APP_URL="https://$SERVICE-$PROJECT_NUMBER.$REGION.run.app"
export PLACEHOLDER=us-docker.pkg.dev/cloudrun/container/hello

gcloud artifacts repositories create signudoc \
  --repository-format=docker --location="$REGION"

gcloud run deploy "$SERVICE" --region="$REGION" --image="$PLACEHOLDER" \
  --service-account="$RUN_SA" --allow-unauthenticated \
  --memory=1Gi --cpu=1 --concurrency=40 --timeout=300 \
  --min-instances=0 --max-instances=3 \
  --no-cpu-throttling \
  --set-env-vars="APP_URL=$APP_URL,GCS_BUCKET=$BUCKET" \
  --set-secrets="DATABASE_URL=signudoc-database-url:latest,BETTER_AUTH_SECRET=signudoc-auth-secret:latest,RETENTION_JOB_SECRET=signudoc-job-secret:latest,RESEND_API_KEY=signudoc-resend-key:latest"

gcloud run jobs create signudoc-migrate --region="$REGION" --image="$PLACEHOLDER" \
  --service-account="$RUN_SA" \
  --set-secrets="DATABASE_URL=signudoc-database-url:latest,DATABASE_URL_UNPOOLED=signudoc-database-url-direct:latest" \
  --command=node --args=db/migrate.mjs \
  --max-retries=0 --task-timeout=600
```

Why these settings:

- `--no-cpu-throttling` keeps the CPU on after a response has been sent. The app finishes some work after it answers (sending the verification and password-reset emails), which a throttled instance may never get to. The instance still scales to zero when idle, so you pay only while it is up.
- `--timeout=300` and `--memory=1Gi` give the daily backup and the PDF sealing room.
- `--allow-unauthenticated` makes the site public. The signing links and sign-in pages need to be reachable by anyone; the app does its own access control. If your organization's policy forbids it, see [Restricted by an organization policy](#restricted-by-an-organization-policy).
- `APP_URL` is the site's address, used in links, sign-in callbacks and emails. Cloud Run's address is predictable, so it can be set before the service exists. Change it when you add your own domain.

## 7. Build and deploy

From the root of this repository:

```bash
gcloud builds submit --config deploy/gcp/cloudbuild.yaml \
  --service-account="projects/$PROJECT_ID/serviceAccounts/$BUILD_SA" \
  --substitutions="_REGION=$REGION,_SERVICE=$SERVICE"
```

The build ([`deploy/gcp/cloudbuild.yaml`](../deploy/gcp/cloudbuild.yaml)) makes the image from the [`Dockerfile`](../Dockerfile), runs the migration job against it (which creates the database tables), and deploys it. It stops before the deploy if a migration fails, so a revision never starts against a schema it does not understand.

When it finishes, open `$APP_URL`. It takes you to a setup page, where you name your organization, give the email address people should write to for help, and create the first account. That account is the administrator.

## 8. Schedule the daily jobs

The cleanup (reminders, expired drafts and links, deadlines) and the backup are plain HTTPS routes. Cloud Scheduler calls them once a day with the secret from step 5, and the routes turn away anyone else.

```bash
export JOB_SECRET=$(gcloud secrets versions access latest --secret=signudoc-job-secret)

gcloud scheduler jobs create http signudoc-retention \
  --location="$REGION" --schedule="0 9 * * *" --time-zone="Etc/UTC" \
  --uri="$APP_URL/api/internal/retention" --http-method=GET \
  --headers="Authorization=Bearer $JOB_SECRET" \
  --attempt-deadline=300s
```

The secret is stored in the job's configuration, so anyone who can view Scheduler jobs in the project can read it. If that matters, leave `signudoc-job-secret` out of the service in step 6: without a secret the route looks after itself (it runs at most once an hour and tells the caller nothing), as described under [Daily cleanup](self-hosting.md#daily-cleanup).

Backups are the next step, because they should go somewhere that survives this project.

## 9. Back up to a second project

Make the backup bucket in a different Google Cloud project, one that nobody who can delete this one can delete, so a removed project, bucket or database is not the end of your records. The app copies the database and the files there once a day.

In the **backup** project:

```bash
export BACKUP_PROJECT=your-backup-project-id
export BACKUP_BUCKET="$BACKUP_PROJECT-signudoc-backup"

gcloud storage buckets create "gs://$BACKUP_BUCKET" --project="$BACKUP_PROJECT" \
  --location="$REGION" --uniform-bucket-level-access --public-access-prevention

# The app can write and prune backups there, and nothing else in that project.
gcloud storage buckets add-iam-policy-binding "gs://$BACKUP_BUCKET" \
  --member="serviceAccount:$RUN_SA" --role=roles/storage.objectUser
```

Then tell the app about it and schedule the run:

```bash
gcloud run services update "$SERVICE" --region="$REGION" \
  --update-env-vars="BACKUP_GCS_BUCKET=$BACKUP_BUCKET"

gcloud scheduler jobs create http signudoc-backup \
  --location="$REGION" --schedule="0 8 * * *" --time-zone="Etc/UTC" \
  --uri="$APP_URL/api/internal/backup" --http-method=GET \
  --headers="Authorization=Bearer $JOB_SECRET" \
  --attempt-deadline=300s
```

[Backup and restore](backup-and-restore.md) says what each run does, how long copies are kept, and how to restore into a new project.

## 10. Your own domain and your own email address

1. **Domain.** The quickest is a Cloud Run domain mapping (check that your region is supported):

   ```bash
   gcloud beta run domain-mappings create --service="$SERVICE" \
     --domain=sign.example.com --region="$REGION"
   ```

   It prints the DNS records to add; the certificate is issued once they resolve. For more control (a CDN, Cloud Armor, one address for several regions), put a global external Application Load Balancer with a serverless network endpoint group in front of the service instead, and add `TRUSTED_PROXY_HOPS=1` to the service's environment, because the load balancer adds its own address to the one the app reads for rate limits.

2. **Tell the app.**

   ```bash
   gcloud run services update "$SERVICE" --region="$REGION" \
     --update-env-vars="APP_URL=https://sign.example.com"
   ```

   Also update the `--uri` of the two Scheduler jobs, or leave them on the `run.app` address, which keeps working.

3. **Email.** Until you do this, Resend delivers only to the address on your Resend account, so you can try the whole product by sending a document to yourself. Under Settings, Organization, enter an address at your own domain; the site lists the DNS records to add and checks them for you.

## Keep it up to date

Settings, SignuDoc, **Check for updates** shows the version you run. It tells you when a newer release exists, but on Google Cloud it does not know where your copy lives, so it does not offer the update pull request; take a new release the way you would any change to your own copy:

```bash
git pull <where you got SignuDoc> main      # or merge the release tag
gcloud builds submit --config deploy/gcp/cloudbuild.yaml \
  --service-account="projects/$PROJECT_ID/serviceAccounts/$BUILD_SA" \
  --substitutions="_REGION=$REGION,_SERVICE=$SERVICE"
```

To deploy on every push instead, connect your repository in Cloud Build (Triggers, Create trigger), choose "Cloud Build configuration file", set it to `deploy/gcp/cloudbuild.yaml`, and select the `signudoc-build` service account.

## Settings

The service reads its settings from its environment. Change one with `gcloud run services update "$SERVICE" --region="$REGION" --update-env-vars=NAME=value` (or `--update-secrets=NAME=secret:latest` for a secret). The full list is in [`.env.example`](../.env.example) and under [Optional settings](self-hosting.md#optional-settings); these are the ones that matter on Google Cloud:

| Variable               | What it does                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | The pooled Neon connection string from step 5. `DATABASE_URL_UNPOOLED` is the direct one, used by the migration job. |
| `GCS_BUCKET`           | The file bucket. Setting it selects Cloud Storage for documents.                                                     |
| `APP_URL`              | The site's public HTTPS address.                                                                                     |
| `BETTER_AUTH_SECRET`   | Signs sessions.                                                                                                      |
| `RETENTION_JOB_SECRET` | Closes the cleanup and backup routes to everyone who does not send it as a bearer token.                             |
| `BACKUP_GCS_BUCKET`    | The backup bucket. Off until set. `BACKUP_KEEP_DAYS` changes how long copies are kept.                               |
| `TRUSTED_PROXY_HOPS`   | `1` when a Google Cloud load balancer is in front of the service. Leave unset for `run.app` and domain mappings.     |
| `SETUP_TOKEN`          | A secret the setup page asks for.                                                                                    |

Vercel-only settings (`BOTID`, `CRON_SECRET`, `BLOB_*`) do nothing here.

## What it costs

There are no seats and no envelope allowance. You pay Google for what runs, and Resend for email:

- **Neon** has a free plan, and its paid plans charge for what the database uses; see [Neon's pricing](https://neon.com/pricing). A database that nobody is using suspends itself, and the first request after that waits a moment for it to wake.
- **Cloud Run** is billed for the time an instance is up. With `--min-instances=0` it is off when nobody is using the site, and the first request after a quiet spell waits a second or two for it to start. Set `--min-instances=1` to avoid that, at a steady cost.
- **Cloud Storage, Artifact Registry, Secret Manager, Cloud Scheduler and Cloud Build** cost little at this scale, and each has a free tier.
- **Resend** has a free plan; see [Resend's pricing](https://resend.com/pricing).

Prices change and differ by region: use the [Google Cloud pricing calculator](https://cloud.google.com/products/calculator) for your numbers, and set a [budget alert](https://cloud.google.com/billing/docs/how-to/budgets) on the project.

## Troubleshooting

**The site shows an error right after the first deploy.** Open the logs: `gcloud run services logs read "$SERVICE" --region="$REGION" --limit=50`. A message naming a variable means a secret or setting from step 5 or 6 is missing.

**The build stops at `run-migrations`.** Read the job's log: `gcloud run jobs executions list --job=signudoc-migrate --region="$REGION"`, then `gcloud logging read` for that execution, or open it in the console. The usual cause is the `signudoc-database-url-direct` secret: check that it is the direct (not `-pooler`) Neon string, that the role can create tables, and that the build account can run the job.

**`gcloud builds submit` is refused or cannot write logs.** The build account is missing a role from step 2, or your organization requires a logs bucket: the config already sends logs to Cloud Logging only (`CLOUD_LOGGING_ONLY`).

**Scheduler shows a 401.** The `Authorization` header differs from the `signudoc-job-secret` the service uses. After rotating the secret, update both: the service picks up `:latest` on its next revision (`gcloud run services update "$SERVICE" --region="$REGION" --update-labels=rotated=$(date +%s)`), and the Scheduler jobs need `gcloud scheduler jobs update http ... --update-headers=...`.

**Uploads over a few megabytes fail.** Cloud Run accepts requests up to 32 MiB and the app's upload limit is 20 MiB, so this is not the platform. Check that nothing in front of the service, such as a load balancer or proxy of your own, has a lower limit.

### Restricted by an organization policy

If `--allow-unauthenticated` is refused with a message about `iam.allowedPolicyMemberDomains` (domain restricted sharing), your organization has to allow public access to this one service: an administrator can set that policy on the project, or you can front the service with a load balancer, which is not subject to it. Without public access, signers cannot open their links.
