<p align="center">
  <img src="docs/images/banner.png" alt="SignuDoc: e-signatures you actually own. Open source and MIT licensed. Send, sign and seal documents from your own Google Cloud project, at $0 per seat. Shown: a signer drawing a signature on a consulting agreement, and both signers marked Signed.">
</p>

<p align="center">
  An e-signature app for your own organization, on your own Google Cloud project.<br>
  Upload a PDF, place fields, send signing links, and keep the sealed, signed copy with its audit certificate.
</p>

<p align="center">
  <a href="docs/deploy-on-google-cloud.md"><b>Deploy on Google Cloud</b></a><br>
  <sub>or <a href="docs/deploy-with-an-agent.md">give this to your LLM</a></sub>
</p>

<p align="center">
  <a href="#everything-it-takes-to-get-a-document-signed">Features</a> ·
  <a href="#signudoc-and-docusign-side-by-side">SignuDoc vs DocuSign</a> ·
  <a href="#what-it-costs">What it costs</a> ·
  <a href="#get-started">Get started</a> ·
  <a href="docs/self-hosting.md">Self-hosting guide</a>
</p>

## Why SignuDoc

**No seats to pay for.** SignuDoc is open source and runs in your own Google Cloud project, so you pay Google for what runs and nothing per person. A 15-person team pays DocuSign $8,100 a year for Business Pro seats, or $5,400 for Standard. SignuDoc costs the same whether one person sends or fifty.

**No envelope allowance to watch.** DocuSign's Standard and Business Pro plans include 100 envelopes per user per year. SignuDoc has no limit of its own: what you can send depends on what you provision and on your email plan.

**Your documents stay in your accounts.** PDFs live in a private Cloud Storage bucket and everything else in a Cloud SQL Postgres database, both in your project and in the region you choose. Nobody else hosts your agreements, and the code is yours to read, change and run.

**Evidence anyone can check.** Every finished PDF and its audit certificate carry a PAdES seal that PDF readers check for changes, the audit trail is hash-chained so an edited or deleted row shows, and anyone holding a copy can check it on the install's public Verify page.

**Basic building blocks.** Cloud Run, Cloud SQL, Cloud Storage, Secret Manager and Cloud Scheduler: nothing exotic to learn, and a guide that lists every command. Google patches the platform, and a deploy is one `gcloud builds submit`.

## Everything it takes to get a document signed

<p align="center">
  <img src="docs/images/how-it-works.png" alt="How it works. 1: upload a PDF and place the fields. 2: signers open a link from their email and type or draw a signature, on any device. 3: everyone gets the sealed PDF and its audit certificate.">
</p>

### Prepare a document in minutes

Upload a PDF, add up to 25 signers in the order they sign, or have some of them sign at the same time, and add people who only receive the finished copy. Then place fields where they belong: signature, initials, date, name, text, number, checkbox, dropdown and radio buttons, each required or optional and each tied to one signer.

![Placing signature, date and dropdown fields for two signers on a master services agreement](docs/images/prepare.png)

<p align="center">
  <sub>The organization, people and documents in these screenshots are made up.</sub>
</p>

### Signing without an account

Each signer gets a link by email, agrees to use electronic records, and signs with a typed or drawn signature on any phone, tablet or computer. Fields from earlier signers stay visible and locked. Signers can download the document before they sign, or decline with a reason, and the sender is told.

![Jordan Lee signing a consulting agreement with a drawn signature, with the earlier signer's signature locked](docs/images/signing.png)

### Know who is signing

For documents that need more than an email link, ask a signer for an access code you give them yourself, or have SignuDoc email a one-time code when they open the link. The audit certificate records how each signer was checked, with their IP address and browser.

### Follow every envelope

The dashboard shows each document as a card with its first page, its status (draft, sent, completed, declined, voided or expired) and who it waits on, with search and a status filter. Each envelope has its own signing deadline, from 3 to 90 days, which you can change while it is out, and automatic reminders every 1, 2, 3 or 7 days, on top of the reminder you can send by hand.

![The dashboard: six documents as cards, with drafts, a sent offer letter, an NDA one of two signed, and completed agreements](docs/images/dashboard.png)

![A sent NDA: its deadline, reminders and Save as template, the two signers, and the timeline](docs/images/envelope.png)

### Templates for the documents you send every week

Open any envelope and choose Save as template. The template keeps the document, the fields and the signing order, with roles instead of names. Using it asks who signs this time and opens a draft ready to send.

### Sealed, certified, and checkable by anyone

When the last signer finishes, SignuDoc builds the signed PDF and an audit certificate, seals both, and emails them to every signer and copy recipient. Names and text in Latin, Greek, Cyrillic, Chinese, Japanese and Korean scripts are drawn correctly. Anyone can drop a copy on the Verify page to see whether it is exactly the file the site produced; the file never leaves their device, only its fingerprint does.

![The Verify page confirming that a signed contractor agreement is unchanged](docs/images/verify.png)

### Your name, logo and color

Signers see your organization, not SignuDoc. Give the install your name, logo and brand color, and they appear on the site, the signing pages and every email. Serve it at your own domain and link your own terms and privacy policy.

![The same signing page in the organization's own green, with its logo](docs/images/branding.png)

### Run by your administrators

The first account is the administrator, and you can make more. Choose who may create an account: people at your email domains, nobody, or anyone. People who only sign never need one. Set how long finished documents are kept, and answer a signer who asks for their data with a built-in export or erasure tool.

### On your phone

SignuDoc works on small screens as well as large ones: check on your documents from your phone, and signers sign from theirs.

<p align="center">
  <img src="docs/images/phone.png" width="300" alt="The dashboard on a phone">
</p>

## SignuDoc and DocuSign, side by side

DocuSign does more, and charges for it per user. SignuDoc does the everyday signing loop well, and it's yours. DocuSign's plans are as [DocuSign listed them](https://ecom.docusign.com/plans-and-pricing/esignature) in November 2026, for the US.

<p align="center">
  <img src="docs/images/compare.png" alt="SignuDoc and DocuSign eSignature side by side, each with a green check for: signing without an account; signing order and copy recipients; signature, initials, date, text and checkbox fields; dropdown and radio button fields (on DocuSign: Business Pro, $45 a seat); reusable templates; deadlines and automatic reminders; your own logo and brand color (on DocuSign: from Standard, $30 a seat); accounts for your whole team (on DocuSign: from Standard); consent to electronic records; audit trail and certificate of completion; a tamper-evident seal on the finished PDF; and working on a phone. To tick every box on DocuSign you need Business Pro at $45 per user a month.">
</p>

<p align="center">
  <img src="docs/images/only-signudoc.png" alt="Six things DocuSign doesn't offer: open source (DocuSign is closed source), runs in your own cloud (DocuSign runs only in its own), no per-seat fees (DocuSign charges $30 or $45 a seat a month), no envelope allowance (DocuSign includes 100 per user a year), every feature included (DocuSign splits them across four plans), and no cap on users (DocuSign's listed plans stop at 50).">
</p>

### Price and ownership

|                                  | SignuDoc                                                                         | DocuSign eSignature                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Price**                        | Free and open source; you pay Google for what runs and Resend for email          | $11 (Personal), $30 (Standard) or $45 (Business Pro) per user a month, on an annual plan |
| **Envelopes**                    | No limit of its own                                                              | 5 a month on Personal, 100 per user a year on Standard and Business Pro                  |
| **Where it runs**                | Your Google Cloud project, with your Cloud SQL database and Cloud Storage bucket | DocuSign's cloud                                                                         |
| **Where data is kept**           | The region you choose, the EU included                                           | DocuSign's data centers, the EU included                                                 |
| **Source code**                  | MIT license, on GitHub                                                           | Closed                                                                                   |
| **Your own domain and branding** | ✅ your domain, logo and color, in every install                                 | Logo and colors from Standard                                                            |

### The signing loop

|                                              | SignuDoc                                                                                                                    | DocuSign eSignature                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Signing without an account**               | ✅                                                                                                                          | ✅                                                                           |
| **Signing order**                            | ✅ in order, at the same time, or mixed, up to 25 signers                                                                   | ✅ in order, at the same time, or mixed                                      |
| **People who only get a copy**               | ✅                                                                                                                          | ✅ and more roles: approvers, editors, in-person signers                     |
| **Field types**                              | ✅ signature, initials, date, name, text, number, checkbox, dropdown, radio, each required or optional                      | ✅ more types; dropdown, radio and signer attachments need Business Pro      |
| **Templates**                                | ✅                                                                                                                          | ✅ from Personal, shared from Standard                                       |
| **Deadlines and automatic reminders**        | ✅                                                                                                                          | ✅                                                                           |
| **Access code and emailed one-time code**    | ✅                                                                                                                          | ✅ plus SMS, phone, knowledge-based questions and ID checks, as paid add-ons |
| **Consent to electronic records**            | ✅ versioned, recorded in the audit trail                                                                                   | ✅                                                                           |
| **Sealed PDF and certificate of completion** | ✅ PAdES seal, self-signed by default or your own trusted certificate, long-term validation (B-LTA) with a timestamp server | ✅ seal trusted by PDF readers                                               |
| **Audit trail**                              | ✅ hash-chained                                                                                                             | ✅                                                                           |
| **Checking a signed copy**                   | ✅ the seal in a PDF reader, and a public Verify page on your own site                                                      | ✅ the seal in a PDF reader                                                  |
| **Retention rules and signer data requests** | ✅ built in                                                                                                                 | ✅                                                                           |
| **Phones**                                   | ✅ in the browser                                                                                                           | ✅ native iPhone and Android apps                                            |

### Where DocuSign does more

|                                                         | SignuDoc                                                          | DocuSign eSignature                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| **More than one document per envelope, and Word files** | — PDF only, one per envelope                                      | ✅                                                    |
| **Bulk send, web forms, payments**                      | —                                                                 | ✅ on Business Pro                                    |
| **API and webhooks**                                    | — not yet                                                         | ✅ API plans from $50 a month                         |
| **Integrations**                                        | —                                                                 | ✅ 1,000+, including Salesforce, Microsoft and Google |
| **Languages**                                           | — signing pages in English                                        | ✅ signing in 44 languages                            |
| **Single sign-on**                                      | — email and password                                              | ✅ SAML SSO on Enhanced                               |
| **Advanced and qualified signatures (eIDAS)**           | With a provider you add: eID Easy or a CSC remote signing service | ✅                                                    |
| **HIPAA, 21 CFR Part 11, certifications**               | Part 11 mode; you validate                                        | ✅ on Enhanced or as add-ons                          |
| **Support**                                             | GitHub issues                                                     | ✅ 24/7 on Enhanced                                   |

If your agreements run through Salesforce, need SMS checks or ID document checks, or go out by the thousand in bulk, DocuSign earns its price. If you want to send everyday agreements, keep the evidence, and own the whole thing, SignuDoc is built for you.

## What it costs

SignuDoc is free. You pay Google Cloud for what your install uses, and [Resend](https://resend.com/pricing) for email (it has a free plan). There are no seats and no envelope allowance, so the cost follows your usage, not your headcount:

- **Cloud SQL** is the one cost that runs all day, because the database is billed for its size whether or not anyone is signing. The tier you pick sets the floor.
- **Cloud Run** is billed for the time the app is up, and scales to zero when nobody is using it.
- **Cloud Storage, Artifact Registry, Secret Manager, Cloud Scheduler and Cloud Build** cost little at this scale.

Work out your own figure in the [Google Cloud pricing calculator](https://cloud.google.com/products/calculator), and set a [budget alert](https://cloud.google.com/billing/docs/how-to/budgets). [What it costs](docs/deploy-on-google-cloud.md#what-it-costs) in the deploy guide says more.

For comparison, DocuSign's US list prices for annual plans in November 2026 are $30 a user a month on Standard and $45 on Business Pro, with 100 envelopes per user a year included. A team of 15 pays $5,400 or $8,100 a year before it sends its first document over the allowance, and those plans stop at 50 users; larger ones are quoted. Prices change, so check them before you quote these.

## Get started

### Deploy to Google Cloud

You need a Google Cloud project with billing on, the `gcloud` CLI, and a [Resend](https://resend.com) API key. The full guide is [Deploy SignuDoc on Google Cloud](docs/deploy-on-google-cloud.md); in outline:

1. **Create the pieces:** a service account, a Cloud SQL Postgres database, a private Cloud Storage bucket, and secrets for the database URL, the session key and your Resend key.
2. **Create the Cloud Run service and a migration job.**
3. **Build and deploy** from this repository: `gcloud builds submit --config deploy/gcp/cloudbuild.yaml`. It builds the image, creates the database tables and deploys.
4. **Open your new site.** Name your organization, give the email address people should write to for help, and create the first account, which is the administrator.
5. **Schedule the daily cleanup and backup** with Cloud Scheduler, and **set up the address you send from** under Settings, Organization.

**Taking new versions.** Settings, SignuDoc, **Check for updates** tells you when a new release is out and what is in it. Merge it into your copy and run the build again. See [Keep it up to date](docs/deploy-on-google-cloud.md#keep-it-up-to-date).

**Deploying with an AI agent.** An agent with `gcloud` can do this for you. Point it at [docs/deploy-with-an-agent.md](docs/deploy-with-an-agent.md), which lists what to ask you, what to check after each part, and when to stop.

Until the sending address is verified, email reaches only the address on your Resend account, so you can try the whole product straight away by sending a document to yourself. The [self-hosting guide](docs/self-hosting.md) covers locking down a new install, running in the EU, the seal, and every optional setting. SignuDoc can also still be deployed to Vercel; that path is described there.

### Try it on your computer

With Node.js 24 and Docker:

```bash
npm install
cp .env.example .env
npm run db:start   # Postgres in Docker, with the schema applied
npm run dev        # SignuDoc at http://localhost:3000
```

Files stay on disk and emails are written to `.data/outbox` instead of being sent, so you need no outside account. [Development](docs/development.md) says more.

## Built on Google Cloud

- **Built from basic Google Cloud services.** Next.js 16 in a container on Cloud Run, Cloud SQL Postgres, private Cloud Storage, Secret Manager, a daily Cloud Scheduler call for reminders and cleanup, and Resend for email.
- **Secure by default.** Private file storage with no public URLs, a strict Content Security Policy, rate limits kept in Postgres, signing links that are hashed at rest, and a setup page that only the first visitor, or the holder of a `SETUP_TOKEN`, can use.
- **Tested.** Unit tests, database tests against a real Postgres, and a browser test that sets up a fresh install, sends a document and signs it, run on every pull request.

## Using SignuDoc for real agreements

SignuDoc is not a law firm and does not give legal advice, and nothing here is a promise that a signature made with it will be accepted for a given purpose. It gives you the features that electronic signature laws such as the US ESIGN Act and UETA and the EU's eIDAS regulation look for in a simple electronic signature: each signer's consent to electronic records, a record of who signed, when and how, optional identity checks, and a sealed copy that shows any change. Whether that is enough for a particular document depends on the document, where you and the signers are, and how you use it. Ask a lawyer when it matters.

Every install has a page at `/electronic-signatures` that says what it is for, and senders confirm it before each send. It is meant for ordinary business agreements, such as contracts, NDAs, statements of work, offer letters, purchase orders and approvals. It is **not** built for:

- documents that need an advanced or qualified electronic signature (AdES or QES) under eIDAS, unless you add a signing provider (see below);
- protected health information under HIPAA;
- documents that many laws keep out of electronic signature, such as wills, family-law matters, court orders, notices of foreclosure, eviction, utility shut-off or insurance cancellation, and in most EU countries real estate transfers and documents that need a notary.

For **advanced or qualified electronic signatures** under eIDAS, connect a signing provider: [eID Easy](https://eideasy.com), or a trust service provider's remote signing service that speaks the CSC API v2. A sender can then choose that signature type for an envelope, and each signer proves who they are at the provider and signs with a certificate in their own name. Every signature goes into the PDF in a revision of its own, so all of them stay valid, and the finished PDF gets long-term validation. The provider is a paid service outside Vercel, so it is optional, and the flow has been tested against stand-ins for both interfaces but not yet against the live services. [Signatures in the signers' own names](docs/self-hosting.md#signatures-in-the-signers-own-names-eidas-ades-and-qes) has the setup.

For FDA 21 CFR Part 11 records, an administrator can turn on **Part 11 mode** under Settings. Signers then sign with their own accounts, whose identity an administrator has confirmed, give their password again at each signature, and see the meaning of their signature (approval, review, responsibility or authorship) printed beside it with their name and the time. Audit trails export as CSV, and finished records are never deleted on a timer. That covers the software's part only: validating your install, writing and following your own procedures, training your people and certifying your electronic signatures to the FDA stay with your organization. The [Part 11 validation pack](docs/part11/README.md) gives you starting documents for that: requirements, a traceability matrix, a risk assessment, qualification scripts, SOP templates and the FDA letter.

Your install carries your organization's name, and your organization is responsible for how it is used: linking your own terms and privacy policy, keeping the support address pointed at a mailbox someone reads, choosing how long documents are kept, and answering signers' data requests. [Your responsibilities](docs/self-hosting.md#your-responsibilities) has the details.

## Learn more

- [Deploy on Google Cloud](docs/deploy-on-google-cloud.md): every command, from an empty project to a running site, with backups.
- [Self-hosting guide](docs/self-hosting.md): deploying, first-run setup, your own domain, updates, the EU, the seal, cleanup, rate limits and every optional setting.
- [Development](docs/development.md): running SignuDoc locally, storage, the database, email, tests and the code's layout.
- [Contributing](CONTRIBUTING.md) and [Security](SECURITY.md).

## License and credits

SignuDoc is [MIT licensed](LICENSE). Copyright © 2026 Nyllon Software. It redistributes third-party assets, including bundled fonts and PDF.js, under their own licenses: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The project has no email address of its own. Report a security problem privately through GitHub, as [SECURITY.md](SECURITY.md) describes. For help with one particular site that runs SignuDoc, write to the organization that runs it.

## Legal disclaimer

**SignuDoc is an independent open source project. It is not affiliated with, associated with, authorized by, endorsed by, sponsored by, or in any way officially connected with DocuSign, Inc., or any of its subsidiaries or affiliates.** SignuDoc is not a DocuSign product, is not built on DocuSign's software or services, and does not use DocuSign's code.

"DocuSign" and related names, marks and logos are trademarks or registered trademarks of DocuSign, Inc. in the United States and other countries. They are used in this repository only to identify DocuSign's products for the purpose of comparison. No claim is made to any of them, and their use does not imply any relationship with, or approval by, DocuSign, Inc. All other product and company names, including Vercel, Neon and Resend, are trademarks of their respective owners, and SignuDoc is not affiliated with or endorsed by them either.

The comparisons on this page were made in good faith from DocuSign's publicly available website and plan documentation as of November 2026, for its US eSignature plans, and from SignuDoc's own code. DocuSign's features, plans and prices change, vary by country and contract, and may differ from what is described here. Nothing on this page is a statement by DocuSign. Check [DocuSign's own website](https://www.docusign.com) for current and authoritative information before you rely on any of it, and tell us through a GitHub issue if something here is out of date or wrong so that it can be corrected.

The cost figures are estimates for illustration, not quotes. What you pay depends on your own use and on the prices of the services your install runs on.

SignuDoc is provided "as is", without warranty of any kind, as the [MIT License](LICENSE) sets out. Nothing in this repository is legal advice. Whether an electronic signature is valid or enforceable for a particular document depends on the law that applies to it; ask a qualified lawyer.
