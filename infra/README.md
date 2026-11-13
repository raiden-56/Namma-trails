# Hosting Namma Trails on AWS

This folder is an AWS CDK app. It describes everything the site needs on AWS as code, so one command creates it, changes it or removes it.

> **Status.** The code builds, turns into valid AWS templates and passes its tests. It has **not been deployed to a real AWS account yet**. The first deploy is the real test. See [What was checked](#what-was-checked-and-what-was-not).

- [Three environments](#three-environments)
- [Stage: the cheapest way to test](#stage-the-cheapest-way-to-test)
- [What gets built](#what-gets-built)
- [Why it is cheap](#why-it-is-cheap)
- [How auto scaling works](#how-auto-scaling-works)
- [AWS integrations](#aws-integrations)
- [What it costs](#what-it-costs)
- [Before the first deploy](#before-the-first-deploy)
- [Deploy the demo](#deploy-the-demo)
- [Day-to-day work](#day-to-day-work)
- [Your own domain](#your-own-domain)
- [Going to production](#going-to-production)
- [Deploy from GitHub](#deploy-from-github)
- [All the settings](#all-the-settings)
- [What was checked, and what was not](#what-was-checked-and-what-was-not)

---

## Three environments

| | **stage** | **demo** | **production** |
|---|---|---|---|
| For | Trying the app now and then | Showing the app, always on | Real visitors |
| Runs on | One small server (EC2) that you switch on and off | Containers (ECS Fargate) with auto scaling | The same, bigger, in two zones |
| Database | A container on the server's own disk | Amazon RDS | Amazon RDS with a standby |
| Cost while off | About US$5 a month | — | — |
| Cost while on | About 2 US cents an hour more | About US$50 to 55 a month | About US$160 to 175 a month and up |
| Deploy with | `-c env=stage` | `-c env=demo` | `-c env=production` |

Pick **stage** if you only want to test and keep the bill close to zero. The rest of this guide, from [What gets built](#what-gets-built) on, is about demo and production.

---

## Stage: the cheapest way to test

Stage is the whole app on **one small server**. You start it when you want to test and stop it when you are done.

```
visitor -> CloudFront (HTTPS, free at this size) -> the server
                                                      web   the website
                                                      api   the API
                                                      db    PostgreSQL, on the server's disk
```

Only what is needed is created: the server, its disk, a fixed address, CloudFront, and the image store that `cdk deploy` uses anyway. There is **no** load balancer, managed database, NAT gateway, secret store, DynamoDB, firewall or alarm. Settings are in `config/stage.ts`.

### Where it runs today

Stage was deployed on 13 Nov 2026 to **Sydney (`ap-southeast-2`)**, the only region the AWS account allows on its current plan.

- Address: <https://d2ppxhqgzoul0v.cloudfront.net>
- It was deployed from **AWS CloudShell** (the terminal inside the AWS website), because this computer has no AWS CLI login. The project copy there is in `~/namma`.

To start or stop it without the AWS CLI on your computer, open CloudShell in the Sydney region and run:

```bash
cd ~/namma/infra && node scripts/stage.mjs start
```

```bash
cd ~/namma/infra && node scripts/stage.mjs stop
```

You can also open **EC2 > Instances** in the AWS website, pick the server named `NammaTrails-Stage/Server`, and use **Instance state > Start / Stop**.

Two things to know about deploying from CloudShell: it has Node 20, so use `npm install --no-package-lock` in `infra` (pnpm 11 needs Node 22), and its disk is small, so run `docker system prune -af` before each `cdk deploy`.

### What it costs

Rough estimates for Mumbai (Sydney is a little dearer). Check them in the AWS Pricing Calculator.

| When | What you pay for | About |
|---|---|---|
| **Stopped** | The fixed address (about $3.65), the 16 GB disk (about $1.50), the stored images (cents) | **US$5 a month** |
| **Running** | The above, plus the `t3.small` server by the hour | **2 to 2.5 US cents an hour** more |
| **Removed** (`cdk destroy`) | Nothing | **$0** |

Example: testing 20 hours in a month costs about US$5.50 in total.

### First time

You need the same things as in [Before the first deploy](#before-the-first-deploy) (AWS login, AWS CLI, Docker running, `cdk bootstrap` once).

1. Deploy (about 10 minutes):

   ```bash
   pnpm exec cdk deploy NammaTrails-Stage -c env=stage
   ```

2. It prints **`SiteUrl`**, for example `https://d1234abcd.cloudfront.net`. Put it into `config/stage.ts`:

   ```ts
   siteUrl: "https://d1234abcd.cloudfront.net",
   ```

3. Deploy again and restart the server, so the website is built with its real address:

   ```bash
   pnpm exec cdk deploy NammaTrails-Stage -c env=stage
   ```

   ```bash
   pnpm stage:restart
   ```

4. Open `SiteUrl` and sign in with a demo account from `docs/15-demo-data.md`. The demo data is loaded by itself on the first start.

### Switching it on and off

Run these in the `infra` folder:

| Command | What it does |
|---|---|
| `pnpm stage:start` | Starts the server and waits until the site answers (about a minute) |
| `pnpm stage:stop` | Stops it. The data is kept. You then pay only for the address and the disk |
| `pnpm stage:status` | Says if it is running, and its address |
| `pnpm stage:restart` | Stop and start. Needed after `cdk deploy` to run the new version |
| `pnpm stage:logs` | Shows what the server printed while starting the app |
| `pnpm stage:shell` | Prints the command that opens a shell on the server |

**It also stops by itself every night** at midnight India time (`autoStopAtUtc` in `config/stage.ts`), so a forgotten server cannot run up a bill.

To remove everything, including the data:

```bash
pnpm exec cdk destroy NammaTrails-Stage -c env=stage
```

### Good to know

- **The data stays** across stop and start: the database lives on the server's disk. It is lost only if you destroy the stack.
- **A new version:** `cdk deploy`, then `pnpm stage:restart`. The server downloads the new images when it starts, and applies database changes first.
- **The address never changes**, because of the fixed address behind CloudFront.
- **Nobody can connect to the server directly.** Only CloudFront reaches the two app ports. There is no SSH; a shell goes through AWS Session Manager.
- **It runs in development mode**, like the demo: test payments, and messages (sign-in codes too) go to the log, not to phones. Read them with `pnpm stage:logs`, or on the server with `docker logs api`.
- **Two helper pages are hidden** (the page that shows one-time codes, and the API docs). To use them while testing, set `blockedPaths: []` in `config/stage.ts`.
- **It is for testing only.** One server, no standby, no managed backups. Do not put real customer data on it.
- **To spend even less while it runs**, try `instanceType: "t3.micro"` (1 GB memory). The three containers use about 260 MB when idle, so it may fit, but this size was not tried.

---

## What gets built

```
visitor
   |  HTTPS
CloudFront            fast edge near the visitor, free HTTPS, caches files that never change
   |  private link (the load balancer has no public address)
Load balancer         /api/* and /health  ->  API service
   |                  everything else     ->  web service
   +--> Web service   Next.js   on ECS Fargate, scales by itself
   +--> API service   NestJS    on ECS Fargate, scales by itself
            |
        PostgreSQL    Amazon RDS, in subnets with no route to the internet
```

| AWS service | What it does here |
|---|---|
| **CloudFront** | The public front door. Gives HTTPS and caches build files and resized pictures |
| **Application Load Balancer** | Sends each request to a healthy task. Internal, so only CloudFront can reach it |
| **ECS on Fargate** | Runs the web and API containers. No servers to look after |
| **Application Auto Scaling** | Adds and removes tasks as traffic changes |
| **ECR** | Stores the Docker images. `cdk deploy` builds and uploads them |
| **RDS for PostgreSQL 17** | The database. Encrypted, backed up, and its disk grows by itself |
| **Secrets Manager** | Holds the database password and the two API secrets. Nobody types them |
| **S3** | Two private buckets: photos (read through CloudFront at `/media/...`) and partner documents |
| **DynamoDB** | Sign-in codes and rate-limit counters. Billed per request |
| **SES and SNS** | Email and SMS (only with `messagingProvider: "aws"`). Billed per message |
| **AWS Backup** | A second, longer-kept set of database backups (production) |
| **VPC** | The private network and the firewall rules between the parts |
| **CloudWatch** | Logs, and alarms sent by email (when you give an address) |
| **IAM** | Each part gets only the rights it needs |
| **Route 53 + ACM** | Only with your own domain: DNS records and a free certificate |
| **AWS WAF** | Web firewall. On for production, off for the demo to save money |
| **AWS Budgets** | Emails you when the month's bill passes a limit you set |

The code is split into stacks, so a new app version can never touch the data:

| Stack | Holds | File |
|---|---|---|
| `NammaTrails-<Env>-Network` | Network and firewall rules | `lib/network-stack.ts` |
| `NammaTrails-<Env>-Data` | Database, secrets, buckets | `lib/data-stack.ts` |
| `NammaTrails-<Env>-App` | Containers, load balancer, CloudFront, alarms | `lib/app-stack.ts` |
| `NammaTrails-<Env>-EdgeCertificate` | HTTPS certificate (only with your own domain) | `lib/edge-certificate-stack.ts` |
| `NammaTrails-GithubDeployRole` | Lets GitHub Actions deploy (optional) | `lib/github-deploy-role-stack.ts` |

One address serves both the web app and the API. That keeps sign-in cookies simple and needs only one load balancer.

---

## Why it is cheap

| Choice | What it saves |
|---|---|
| **No NAT gateway.** Tasks run in public subnets, and the firewall lets only the load balancer in | About US$40 a month for each gateway |
| **Fargate Spot** for tasks (all of them in the demo; all but the first in production) | About 70% of the compute price |
| **One load balancer** for web and API, routed by path | A second load balancer, about US$18 a month |
| **Internal load balancer** behind CloudFront | The public IPv4 fee on the load balancer |
| **Small ARM database** (`db.t4g.micro`), one zone in the demo | It is the cheapest RDS size |
| **CloudFront** caches build files, and the first 1 TB a month is free | Less work and traffic for the tasks |
| **Auto scaling** with a small minimum | You pay for 1 task when it is quiet, not for the peak |
| **Redis is off** because the API does not use it yet | About US$6 to 12 a month |
| **Short log retention** (7 days in the demo) | Log storage |
| **No WAF, alarms or detailed metrics in the demo** | About US$10 to 15 a month |

Optional extra saving: `nightlyStop` in the settings stops all tasks at night. The site is then down at night.

Another 20% off compute is possible with `cpuArchitecture: "ARM64"`. The images must then be built for ARM, which is very slow on a normal Intel/AMD laptop, so it is off by default.

---

## How auto scaling works

Each service (web and API) has its own rules, set in `config/environments.ts`:

| Setting | Demo | Production | Meaning |
|---|---|---|---|
| `minTasks` | 1 | 2 | Never fewer tasks than this |
| `maxTasks` | 3 | 8 | Never more than this. It also caps the bill |
| `targetCpuPercent` | 65 | 60 | Add tasks when average CPU stays above this |
| `targetRequestsPerTaskPerMinute` | 600 | 1000 | Add tasks when one task gets more requests than this |
| `onDemandBase` | 0 | 1 | Tasks that are never on Spot |

- **Scale out is fast:** a new task is added about a minute after a target is passed.
- **Scale in is slow:** tasks are removed after about five quiet minutes, so a short dip does not remove tasks that are needed again a moment later.
- **The database disk** grows by itself, from 20 GB up to the limit you set.
- **A bad release rolls back by itself.** New tasks must pass the health check before old ones stop. If they never do, ECS goes back to the old version.
- **A Spot task that AWS takes back** is replaced by itself. In production the first task of each service is not on Spot, so a service is never fully down.

To change a limit, edit the number and deploy again.

---

## AWS integrations

Each one is switched on by a setting, and the app runs without any of them on your own computer.

| What | AWS service | How it works | Setting |
|---|---|---|---|
| **Sign-in codes (OTP)** | DynamoDB, SES, SNS | Your own sign-in stays as it is. The codes are kept in DynamoDB (only a hash, removed by itself after use) and sent by email or SMS | `dynamoStores`, `messagingProvider` |
| **Email** | Amazon SES | One sender address for all mail. Billed per email, no monthly fee | `messagingProvider: "aws"`, `mailFrom` |
| **SMS** | Amazon SNS | Sent as "transactional" (the class for codes). Billed per SMS | `messagingProvider: "aws"`, `sms` |
| **Notifications** | SES / SNS | The traveller is told when a booking is requested, confirmed or cancelled; the partner about a new booking and about the decision on their application. Every message is recorded with its result | `messagingProvider` |
| **Rate limits** | DynamoDB | The counters are shared by all API tasks, so auto scaling cannot multiply a limit | `dynamoStores` |
| **Images and files** | S3 + CloudFront | The browser uploads straight to S3 with a one-time link. Photos are read through the CDN at `/media/...`. Documents are private and need a short-lived link | always on |
| **Soft delete** | S3 versioning | Nothing is deleted for good. See below | always on |
| **Backups** | RDS + AWS Backup | The database always has its own backups. AWS Backup adds a nightly and a weekly copy that are kept longer | `backups` |
| **Logs** | CloudWatch | All container logs, plus counts of errors, audited actions and failed messages, an alarm for each, and one dashboard | `logRetentionDays`, `dashboard`, `alarmEmail` |

### What goes where

Only short-lived, simple data moved to DynamoDB: **sign-in codes** and **rate-limit counters**. They are read by one key, never joined to anything, and worthless after a few minutes. DynamoDB bills them per request and deletes them by itself.

**Bookings, payments, partners and listings stay in PostgreSQL.** They need transactions and rules that span several tables (for example "never sell the same seat twice"). Moving them would make the app less safe and not cheaper.

### Soft delete

| Where | What "delete" does |
|---|---|
| Rows in PostgreSQL | The row is marked (`deleted_at`, `removed_at` or `is_active`) and kept. A test fails if anyone adds a real `delete` to the API code |
| Uploaded files | The file is marked as deleted in the database and hidden. The object stays in S3 |
| S3 buckets | Both keep old versions. A file that is removed or overwritten can be brought back for 30 days (photos) or 90 days (documents) |
| Database | Delete protection and a final snapshot in production |
| Who did it | Every create, change and delete is in the `audit_logs` table and as a line in CloudWatch |

The one thing that does expire on purpose: used and old sign-in codes and rate-limit counters. They are not records of anything.

### To do outside the code before real users

AWS asks for these by hand, once:

1. **SES:** a new account is in the "sandbox" and can only send to addresses you have verified. Ask for production access in the SES console (Account dashboard).
2. **SNS SMS:** the monthly SMS spending limit starts at 1 US dollar. Ask AWS to raise it (Service Quotas).
3. **SMS to Indian numbers:** register on a DLT portal, then put the entity id and the template id in `sms.dltEntityId` and `sms.dltOtpTemplateId`. Operators block SMS without them. The exact wording of each SMS is in `apps/api/src/modules/messaging/templates.ts`.

---

## What it costs

These are **rough estimates** for Mumbai with very little traffic, made from public list prices. Check them in the [AWS Pricing Calculator](https://calculator.aws/) before you rely on them. A new AWS account may also get free-tier credit.

**Demo, running all day: about US$50 to 55 a month**

| Item | About, per month |
|---|---|
| Load balancer | $19 |
| Database `db.t4g.micro` + 20 GB | $16 |
| 2 Fargate Spot tasks (0.25 vCPU, 0.5 GB each) | $6 |
| Public IPv4 address for 2 tasks | $7 |
| Secrets Manager (3 secrets) | $1 |
| Logs, image storage | $1 to 2 |
| CloudFront | $0 at low traffic |

**Production at its smallest size: about US$160 to 175 a month**

| Item | About, per month |
|---|---|
| 4 tasks (0.5 vCPU, 1 GB): 2 on-demand, 2 on Spot | $50 |
| Database `db.t4g.small`, two zones + storage | $58 |
| Load balancer | $20 |
| Public IPv4 address for 4 tasks | $15 |
| WAF | $10 |
| Logs, metrics, alarms, secrets, DNS | $10 to 20 |

Each extra task that auto scaling adds costs about $6 to 10 a month on Spot, only while it runs.

**The integrations add very little at low traffic**

| Item | How it is billed | About |
|---|---|---|
| DynamoDB (codes, rate limits) | Per request, no hourly fee. One small write per API request | Under $1 a month for a million API requests |
| S3 | Per GB stored | Cents, until there are many photos |
| SES email | Per email | About $0.10 for 1,000 emails |
| SNS SMS | Per SMS, price depends on the country | Check the SNS price list for India |
| CloudWatch log counts (3 numbers) | Per custom metric | About $1 a month |
| Dashboard | The first three are free | $0 |
| AWS Backup (production) | Per GB of backup kept | A few dollars, grows with the database |

---

## Before the first deploy

You need these on your computer:

1. **An AWS account**, and a login for it that may create resources.
2. **AWS CLI v2**, signed in. Check with `aws sts get-caller-identity`.
3. **Docker Desktop**, running. CDK builds the two images on your computer.
4. **Node.js 22 or newer** and **pnpm**.

Then, once per AWS account:

```bash
cd infra
pnpm install
pnpm exec cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-south-1
```

`bootstrap` makes the small bucket and image store that CDK itself needs.

### On a company network that inspects HTTPS

Many company networks open and re-sign HTTPS traffic with their own root certificate. Your computer trusts that certificate, but a Docker build does not, so the build cannot download packages or the Google fonts. You will see errors such as `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` or `Failed to fetch ... from Google Fonts`.

The fix is to hand the company root certificate to the build:

1. Save the company root certificate as a `.pem` file somewhere outside the project. Your IT team can give it to you, or you can export it from the Windows certificate store ("Trusted Root Certification Authorities").
2. Point `NODE_EXTRA_CA_CERTS` at that file before you deploy. In PowerShell:

   ```powershell
   $env:NODE_EXTRA_CA_CERTS = "C:\path\to\company-root.pem"
   ```

CDK then passes the file to both image builds as a build secret. It is used only while building and is not stored in the images.

If the build is still slow or drops out, deploy from GitHub instead (see [Deploy from GitHub](#deploy-from-github)). GitHub's build machines are not behind your company network.

---

## Deploy the demo

The demo runs the API in development mode with demo data and the test payment simulator. This is what the app can run as today.

**1. First deploy** (about 20 to 30 minutes; the database and CloudFront take the longest):

```bash
cd infra
pnpm exec cdk deploy --all -c env=demo
```

At the end it prints **`SiteUrl`**, for example `https://d1234abcd.cloudfront.net`.

**2. Tell the web app its address.** The address is written into the web pages when the image is built, and it is only known now. Open `config/environments.ts`, and in the `demo` block add:

```ts
siteUrl: "https://d1234abcd.cloudfront.net",
```

**3. Deploy again** (a few minutes; only the web image is rebuilt):

```bash
pnpm exec cdk deploy NammaTrails-Demo-App -c env=demo
```

With your own domain you skip steps 2 and 3, because the address is known from the start.

**4. Load the starting data.** The deploy prints **`RunApiTaskCommand`**. Copy it and add one job file to the end. Run the two jobs one after the other:

```bash
<RunApiTaskCommand> --overrides file://tasks/seed.json
```

```bash
<RunApiTaskCommand> --overrides file://tasks/seed-demo.json
```

`seed.json` loads the reference data (towns, categories). `seed-demo.json` loads the demo partners, listings and bookings. Each job takes a minute or two. Watch it with:

```bash
aws logs tail <ApiLogGroup> --follow --region ap-south-1
```

**5. Open `SiteUrl`** and sign in with a demo account from `docs/15-demo-data.md`.

To make a real admin instead, copy `tasks/create-admin.example.json` to `tasks/create-admin.json`, put in your name, phone and email, and run it the same way. The new password is printed once in the API log.

> In the demo, two helper pages of the API are blocked at the load balancer: the page that shows one-time codes and the API docs. That is why signing **up** with a phone code does not work in the hosted demo. Signing **in** with a demo account does.

---

## Day-to-day work

| I want to | Do this |
|---|---|
| Release a new version | `pnpm exec cdk deploy NammaTrails-Demo-App -c env=demo` |
| See what a deploy would change | `pnpm exec cdk diff -c env=demo` |
| Read the logs | `aws logs tail <ApiLogGroup> --follow --region ap-south-1` |
| Open a shell in a running task | `aws ecs execute-command --cluster <ClusterName> --task <task id> --container api --interactive --command "/bin/sh" --region ap-south-1` |
| Change sizes or scaling limits | Edit `config/environments.ts`, then deploy |
| Get alarm emails | Add `alarmEmail: "you@example.com"` to the environment, deploy, and click the link in the email AWS sends |
| Get a budget warning | Add `monthlyBudgetUsd: 80` as well |
| Remove the demo completely | `pnpm exec cdk destroy --all -c env=demo` |

Database changes need no extra step. Every new API task first runs `prisma migrate deploy`. If that fails, the new version does not start and the old one keeps running.

---

## Your own domain

The domain must be in a Route 53 hosted zone in the same AWS account.

1. Bootstrap the `us-east-1` region once. CloudFront only takes certificates from there:

   ```bash
   pnpm exec cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
   ```

2. In `config/environments.ts`, add to the environment:

   ```ts
   domain: {
     name: "nammatrails.in",
     alternateNames: ["www.nammatrails.in"],
     hostedZoneId: "Z0123456789ABC",
     hostedZoneName: "nammatrails.in",
   },
   ```

3. Deploy with `--all`. CDK makes the certificate, the DNS records and points CloudFront at the name.

---

## Going to production

The `production` environment in the settings is ready: two tasks per service in two zones, a standby database, backups for 14 days, WAF, and protection against deleting the data by accident.

**But the app itself is not ready for production mode yet.** The API refuses to start as `production` (or `staging`) until one more thing is built in the app: the real payment gateway. Today only the test simulator exists.

Email and SMS are ready: the production settings use `messagingProvider: "aws"`.

Until payments are built, `cdk deploy -c env=production` will create everything, and then the API tasks will fail to start and ECS will keep the service empty. So deploy production only after that part is done.

When it is done, also plan for:

- the Razorpay keys as new secrets in `lib/data-stack.ts`, passed to the API in `lib/app-stack.ts`,
- the three steps under [To do outside the code before real users](#to-do-outside-the-code-before-real-users),
- `alarmEmail` and `monthlyBudgetUsd` in the production settings,
- your own domain (see above). Production needs a domain or a `mailFrom` address.

You can already try real email and SMS in the demo: set `messagingProvider: "aws"` and `mailFrom` in the `demo` block. The demo then stops writing codes to the log and sends them for real.

---

## Deploy from GitHub

Two workflow files are in `.github/workflows/`:

- `infra.yml` checks this folder (type check, tests, `cdk synth`) on every change to it.
- `deploy.yml` deploys when you press **Run workflow** in the Actions tab. It never runs by itself.

To let GitHub deploy without storing an AWS key:

1. Create the deploy role once, from your computer:

   ```bash
   pnpm exec cdk deploy NammaTrails-GithubDeployRole -c env=demo -c githubRepo=OWNER/REPO
   ```

2. It prints `DeployRoleArn`. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add a variable named `AWS_DEPLOY_ROLE_ARN` with that value.
3. In GitHub, open **Settings → Environments**, create `demo` and `production`, and add required reviewers to `production` so a person must approve each production deploy.

---

## All the settings

Everything is in `config/environments.ts`, with a comment on each value. The main ones:

| Setting | What it does |
|---|---|
| `web`, `api` | Task size, scaling limits and Spot use for each service |
| `database` | Size, standby copy, disk size and limit, backup days, delete protection |
| `natGateways` | `0` = cheap public subnets. `1` or `2` = private subnets behind NAT |
| `cpuArchitecture` | `X86_64` or `ARM64` |
| `messagingProvider`, `mailFrom`, `sms` | Who sends email and SMS, the sender address, and the SMS ids for India |
| `dynamoStores` | Keeps sign-in codes and rate-limit counters in DynamoDB |
| `backups` | Adds the AWS Backup plan for the database (nightly and weekly) |
| `dashboard` | Adds the CloudWatch dashboard |
| `redis` | Adds a serverless Redis and gives the API its address |
| `waf` | Adds the web firewall |
| `blockedPaths` | Paths the load balancer answers with "404" |
| `nightlyStop` | Stops all tasks at night |
| `domain`, `siteUrl` | The public address |
| `alarmEmail`, `monthlyBudgetUsd` | Alarm emails and the budget warning |
| `logRetentionDays`, `containerInsights` | How much monitoring data to keep |

Useful commands:

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm synth
```

---

## What was checked, and what was not

**Checked**

- The CDK code passes the TypeScript check.
- `cdk synth` makes valid templates for the demo and for production (with a domain, alarms, a budget and the GitHub role), with no AWS login.
- 28 tests check the important promises: the database and buckets are private, the load balancer is internal, no rule lets the whole internet in, both services scale between their limits on CPU and requests, Spot is used as set, migrations run before the API, and secrets never appear as plain settings. They also check the integrations: the DynamoDB tables, the CDN path for images, the narrow rights for email and SMS, the backup plan and the log counts.
- The integrations were run on a computer against stand-ins for AWS (DynamoDB Local and S3Mock), with 37 checks: codes kept in DynamoDB and usable once, shared rate limits, uploads to S3 with one-time links, private documents, soft deletes that keep the data, and booking notifications recorded once each. Email and SMS sending was checked against a recording stand-in, not against real SES and SNS.
- Both Docker images were built and run on a computer, wired up the way AWS will wire them:
  - a PostgreSQL with SSL switched on (as RDS has), reached with the same five `DB_*` values that ECS injects,
  - the migration job, the seed job and the demo-data job, each run from the API image,
  - the API refused the database when it did not trust the certificate, and connected (encrypted) when it did,
  - a small stand-in for the load balancer in front: `/api` and `/health` to the API, the rest to the web app, helper pages answered with 404,
  - a real browser signed in, kept its session after a reload, opened a listing rendered on the server and got a live price, with no errors,
  - the API recorded the visitor's own address through two proxies (`TRUST_PROXY_HOPS=2`),
  - both containers run as a non-root user and idle at about 110 to 125 MB of memory, so the 512 MB task size fits.

**Not checked**

- **No real deploy was done.** There was no AWS login on the computer where this was written. Things that only show up on a real deploy (limits on the account, a value AWS rejects, timing, the CloudFront private link to the load balancer) are still open.
- The cost figures are estimates.
- The `ARM64`, `redis` and `natGateways` switches were only checked as templates.

**Good to know**

- The API image is about 1 GB, because it keeps the Prisma command-line tool for migrations. It works, but it could be made smaller later.
- A listing page shows an error page if the API cannot be reached while the page is being made. That is how the app behaves today, on AWS or anywhere else.
