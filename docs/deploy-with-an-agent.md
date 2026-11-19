# Deploying SignuDoc on Google Cloud with an agent

This page is for an AI agent that has a shell with the `gcloud` CLI and has been asked to deploy SignuDoc to Google Cloud for someone. It says what to ask the person, which guide to follow, what to check after each part, and when to stop. A person can follow it too.

The commands themselves are in [Deploy SignuDoc on Google Cloud](deploy-on-google-cloud.md). Run them from there; this page does not repeat them.

The person you are working for is called "the person" below.

## Before you start

- Run `gcloud auth list` and `gcloud config list`. The CLI must already be signed in as the person, or as a service account they gave you. If it is not, stop and ask them to run `gcloud auth login` themselves. Never type a password, a one-time code or a passkey prompt for them unless they give you that job.
- Ask the person for these before you begin, so you are not stopped half way:
  1. **The Google Cloud project ID** to deploy into, which must already have billing turned on. Do not create a project or link a billing account yourself.
  2. **The region.** Use `us-west1` (Oregon) unless they will sign agreements in the EU; then choose an EU region such as `europe-west4`. Everything uses the one region.
  3. **A [Resend](https://resend.com) API key** for email. They create it in their Resend account; ask them to paste it, and put it straight into Secret Manager (step 5 of the guide). Do not write it to a file or repeat it in your messages.
  4. **The domain email should come from**, for example `acme.com`. SignuDoc suggests a `sign.` subdomain (`sign.acme.com`) so its email stays apart from the organization's own. If they have none yet, email can wait.
  5. **The organization's name**, the **support email address**, and the **administrator's name and email address**, for the setup page.
  6. **The two Neon connection strings** (pooled and direct) from a Neon project they created. Ask them to paste each when step 5 prompts for it; never echo, log or repeat them.
  7. **A second project for backups**, if they want them (they should: step 9 of the guide). Do not create projects for them.
- Do one numbered section of the guide at a time, and check the result before you move on.

## Checks, by section of the guide

| Section             | Check before going on                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Names, services  | `gcloud services list --enabled` lists the services.                                                                                                                         |
| 3. Database         | The person has created the Neon project and given you both connection strings (pooled and direct). You cannot check Neon from `gcloud`; step 7's migration job is the check. |
| 4. Bucket           | `gcloud storage buckets describe gs://$BUCKET --format='value(iamConfiguration.publicAccessPrevention)'` prints `enforced`.                                                  |
| 5. Secrets          | `gcloud secrets list` shows four secrets. Never print a secret's value.                                                                                                      |
| 7. Build and deploy | The build ends with `SUCCESS`. If it stops at `run-migrations`, see the guide's Troubleshooting. Do not rerun it in a loop: after three failures, stop and report the log.   |
| After 7             | Open `$APP_URL`. A new install belongs to whoever opens it first, so do this straight away, and go to the setup page (`/setup`).                                             |
| 8 and 9. Schedulers | `gcloud scheduler jobs run signudoc-retention --location=$REGION` and look for a 2xx in `gcloud scheduler jobs describe`; same for `signudoc-backup`.                        |

## Setting the site up

On `/setup`:

1. Enter the **organization's name** and the **support email address**.
2. Enter the **administrator's name** and **email**. Let the person type the password, or use their password manager if they told you to. Never make one up and keep it.
3. Finish setup. You are signed in as the administrator.

Then, under **Settings, Organization**, the email section lists the DNS records for the sending domain. Give the person the list to add where their domain is managed; the page checks them again by itself, which can take from minutes to a few hours. Until a sender address is saved and verified, Resend delivers only to the address on the person's Resend account, so they can still try the product by sending a document to themselves.

## Report back

Tell the person:

- the site's address and the project, region and resource names you created,
- whether email is verified, and any DNS records they still have to add,
- when the daily jobs run, and that the Scheduler jobs hold the job secret,
- anything you could not do, and why.

Then point them to the [self-hosting guide](self-hosting.md) for their own web address, `SETUP_TOKEN` and keeping the install up to date.

## Rules for the agent

- Never pay for, upgrade or start a trial of anything, and never enable billing, without the person's say-so.
- Never delete a project, Neon database, bucket, secret or repository to "start over". If something is badly wrong, stop and ask.
- Never print or copy a secret (API keys, the database URL, the password, the job secret) into a chat, a file or a message. Pipe it from one command into the next, as the guide does.
- Never grant `allUsers` or `allAuthenticatedUsers` access to a bucket, a secret or the database. The only public thing is the Cloud Run service itself.
- Do not widen an IAM role beyond what the guide gives, and do not turn off an organization policy. If one blocks a step, say which and ask.
