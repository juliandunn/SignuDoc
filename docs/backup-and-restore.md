# Backup and restore

A SignuDoc install on Google Cloud keeps its records in two places: the Neon Postgres database (accounts, envelopes, audit trails, settings) and the Cloud Storage bucket (the PDFs, sealed copies and certificates). This page covers what protects each one, how to turn on SignuDoc's own daily backup, and how to restore from it.

## What you have without doing anything

- **Neon** keeps the database's history for a restore window and can restore it to a point in time, or branch from it, from the Neon console. The window is short on the free plan and longer on paid plans; see Neon's plan page for the current numbers. It protects against a bad change, not against losing the Neon project or account.
- **Cloud Storage** keeps a deleted or overwritten file for seven days (soft delete, on by default for new buckets) and you can restore it in that time with `gcloud storage restore`. After that it is gone. You can raise the window on the bucket, or turn on object versioning.

So the daily backup is worth turning on for any install whose documents matter: it puts a copy in a second project, where deleting the install does not reach it.

## Turn on the daily backup

The backup copies the install, once a day, to a second bucket that you keep apart from the first. The steps are [section 9 of the deploy guide](deploy-on-google-cloud.md#9-back-up-to-a-second-project): make a private bucket in **another Google Cloud project**, give the app's service account Storage Object User on it, set `BACKUP_GCS_BUCKET` on the service, and schedule `/api/internal/backup` with Cloud Scheduler.

From then on, every day at 08:00 UTC (or when you set it), each run:

- writes the whole database, read as one consistent snapshot, to `database/<time>.ndjson.gz` in the backup bucket, and keeps `BACKUP_KEEP_DAYS` days of them (30 unless you set it, and never fewer than the newest three);
- copies every file that is new or changed since the last run to `files/<same path>`. A run copies for up to four minutes; a first backup of a large install may take a few days to catch up, and each later run only copies what changed;
- keeps the copy of a file that was deleted from the install (by the retention rules, for example) for `BACKUP_KEEP_DAYS` more days, then removes it, so the backup does not hold a document much longer than your retention rules allow.

Do not put a retention lock on the backup bucket that is longer than `BACKUP_KEEP_DAYS`: the app prunes its own old copies, and a lock would make that fail.

To run one by hand, call the same address with the secret: `curl -H "Authorization: Bearer $(gcloud secrets versions access latest --secret=signudoc-job-secret)" "$APP_URL/api/internal/backup"`, or `gcloud scheduler jobs run signudoc-backup --location="$REGION"`.

Each run writes a `backup_finished` line to Cloud Logging (with the counts), or `backup_failure` if it failed. Make a [log-based alert](https://cloud.google.com/logging/docs/alerting/log-based-alerts) on the failure and on the absence of the finished line. The app refuses a backup bucket that is its own bucket, because that backup would not survive what it is for.

**Cost.** The backup bucket holds about as much as the install's bucket, plus the database copies. Each copied file is one write to the backup bucket.

**Check it works.** After the first run, open the backup bucket and look for `database/` and `files/`. Every few months, do a test restore (below) into a throwaway project, so you know the steps before you need them.

## Restore

A restore goes into a **new, empty** database and bucket, never over a live install. You can then point the install at them, or deploy a new install on them.

You need a computer with Node.js 24, a copy of this repository at the same version as the install (or newer), and network access to Neon.

1. Make a new, empty Neon database (a new Neon project, or a new branch with no data, [as in the deploy guide](deploy-on-google-cloud.md#3-database)) and copy its **direct** connection string. Or, if the install's database still exists and only the files were lost, use `--skip-files` and skip this.
2. Make a new private bucket for the restored files (step 4). Or, if the install's bucket still exists and only the database was lost, use `--skip-files` and skip this.
3. Sign in so the script can reach both buckets:

   ```sh
   gcloud auth application-default login
   ```

4. In the repository folder:

   ```sh
   npm ci
   export DATABASE_URL='postgres://…'     # the new, empty database (direct string)
   export GCS_BUCKET='…'                  # the new install bucket
   export BACKUP_GCS_BUCKET='…'           # the backup bucket
   npm run restore-backup -- --list       # see which backups there are
   npm run restore-backup                 # restore the newest one
   ```

   `--backup database/<name>` restores an older one instead. The script applies the migrations, loads the database in one transaction (so a failed restore leaves nothing half done), then copies the files back to their own paths. It refuses a database that already has accounts in it, and a backup made by a newer SignuDoc than the copy you are running. If copying the files stops part way (a network error, or you stopped it), run `npm run restore-backup -- --files-only` to finish: it skips the database and every file that is already there.

5. Point the install at them: put the new strings in the `signudoc-database-url` (pooled) and `signudoc-database-url-direct` secrets as new versions, set `GCS_BUCKET` on the service, keep `BETTER_AUTH_SECRET` the same as before, and deploy. Two-step sign-in keys are encrypted with that secret, and session cookies are signed with it; if it changes, everyone is signed out, and nobody who used two-step sign-in can finish signing in until their setup is cleared (see the note on two-step sign-in in [self-hosting](self-hosting.md#sign-in-security)).
6. Sign in, open a finished document, and check its audit trail and download.

What a restore brings back: everything in the database at the time of the backup, and every file as of the last run. A document sent after the last backup is not in it. The hash chains in both audit trails come back exactly as they were, so they still verify.

## In a security review

- **Backup frequency:** daily, at 08:00 UTC by default (the Cloud Scheduler job's schedule).
- **Retention:** `BACKUP_KEEP_DAYS` (30 by default) for database copies and deleted files.
- **Location and access:** a private Cloud Storage bucket in a second project chosen by the deployer. Only the app's service account and that project's own administrators can read it.
- **Encryption:** Cloud Storage and Neon encrypt stored data at rest (see Google's and Neon's security documentation). The database copy holds the same data as the database, including password hashes and the encrypted two-step sign-in keys, so treat access to the backup bucket like access to the database.
- **Restore testing:** the procedure above, run by the deployer on a schedule they choose.
