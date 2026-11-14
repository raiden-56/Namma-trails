#!/usr/bin/env node
// Switches the stage server on and off. Run it from the infra folder:
//
//   pnpm stage:start     start the server and wait until the site answers
//   pnpm stage:stop      stop it (you then pay only for its address and disk)
//   pnpm stage:status    is it running, and what is its address
//   pnpm stage:restart   stop and start: needed after `cdk deploy` to run the new version
//   pnpm stage:logs      what the server printed while starting the app
//   pnpm stage:codes     the newest messages the app "sent" (one-time codes for sign-up and sign-in)
//   pnpm stage:shell     prints the command that opens a shell on the server
//
// Stage sends no real email or SMS: the API keeps each message, and `codes` reads them.
// To see only one person's messages, add the phone number or email:
//   node scripts/stage.mjs codes +919876543210
//
// It uses the AWS CLI with your own login, and reads the server's id from the stack.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STACK = "NammaTrails-Stage";
// The region of the stage environment (infra/config/stage.ts).
const REGION = process.env.STAGE_REGION ?? "ap-southeast-2";
const command = process.argv[2] ?? "status";

function aws(args, { quiet = false } = {}) {
  try {
    return execFileSync("aws", [...args, "--region", REGION, "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", quiet ? "ignore" : "inherit"], shell: process.platform === "win32" });
  } catch (error) {
    if (error.code === "ENOENT") fail("The AWS CLI is not installed. Install it and sign in first (aws sts get-caller-identity).");
    throw error;
  }
}
function fail(message) {
  console.error(message);
  process.exit(1);
}

function outputs() {
  // Say clearly what is missing: the AWS CLI itself, the login, or the deployed stack.
  try {
    execFileSync("aws", ["--version"], { stdio: "ignore", shell: process.platform === "win32" });
  } catch {
    fail("The AWS CLI was not found. Install AWS CLI v2 and sign in first (check with: aws sts get-caller-identity).");
  }
  try {
    execFileSync("aws", ["sts", "get-caller-identity"], { stdio: "ignore", shell: process.platform === "win32" });
  } catch {
    fail("The AWS CLI is not signed in. Sign in first (check with: aws sts get-caller-identity).");
  }
  let stack;
  try {
    stack = JSON.parse(aws(["cloudformation", "describe-stacks", "--stack-name", STACK], { quiet: true })).Stacks[0];
  } catch {
    fail(`The stage environment is not deployed yet. Deploy it first: pnpm exec cdk deploy ${STACK} -c env=stage`);
  }
  return Object.fromEntries((stack.Outputs ?? []).map((o) => [o.OutputKey, o.OutputValue]));
}
const { ServerId: id, SiteUrl: site } = outputs();
if (!id) fail("The stack has no ServerId output. Deploy the stage environment again.");

const state = () => JSON.parse(aws(["ec2", "describe-instances", "--instance-ids", id])).Reservations[0].Instances[0].State.Name;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForState(wanted) {
  for (let i = 0; i < 60; i++) {
    const now = state();
    if (now === wanted) return;
    process.stdout.write(`  ${now}...\r`);
    await sleep(5000);
  }
  fail(`The server did not reach "${wanted}" in time. Check it in the AWS console.`);
}

async function waitForSite() {
  console.log("Waiting for the site to answer (the first start takes a few minutes: it loads the demo data)...");
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(`${site}/health/ready`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await sleep(5000);
  }
  return false;
}

/** Runs shell commands on the server through Systems Manager and returns what they printed. */
async function runOnServer(commands) {
  if (state() !== "running") fail("The server is stopped. Start it first: pnpm stage:start");
  // The request goes through a file, so quotes in the commands survive every shell.
  const folder = mkdtempSync(join(tmpdir(), "namma-stage-"));
  const file = join(folder, "command.json");
  try {
    writeFileSync(file, JSON.stringify({ InstanceIds: [id], DocumentName: "AWS-RunShellScript", Parameters: { commands } }));
    const sent = JSON.parse(aws(["ssm", "send-command", "--cli-input-json", `file://${file}`]));
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const result = JSON.parse(aws(["ssm", "get-command-invocation", "--command-id", sent.Command.CommandId, "--instance-id", id]));
      if (result.Status === "Pending" || result.Status === "InProgress" || result.Status === "Delayed") continue;
      return result.StandardOutputContent || result.StandardErrorContent || `(${result.Status})`;
    }
    fail("The server did not answer in time. Try again.");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

async function codes(onlyTo) {
  // The API keeps the last messages in memory (they are gone after a restart). Its list
  // is closed from outside, so it is read on the server itself.
  const printed = await runOnServer([
    `curl -s http://localhost:4000/api/v1/dev/outbox | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['data'][:40]))"`,
  ]);
  let messages;
  try {
    messages = JSON.parse(printed);
  } catch {
    fail(`Could not read the messages. The server said:\n${printed}`);
  }
  if (onlyTo) messages = messages.filter((m) => m.to === onlyTo);
  if (messages.length === 0) return console.log(onlyTo ? `No messages for ${onlyTo} yet.` : "No messages yet. Ask for a code on the site first.");
  console.log("Newest first. Times are UTC (India is 5:30 ahead).\n");
  for (const m of messages.slice(0, 15)) {
    const details = Object.entries(m.variables ?? {}).map(([key, value]) => `${key}=${value}`).join("  ");
    console.log(`${m.sentAt.slice(11, 19)}  ${m.channel.padEnd(5)}  ${m.to}  [${m.template}]  ${details}`);
  }
}

async function start() {
  if (state() === "running") console.log("The server is already running.");
  else {
    console.log("Starting the server...");
    aws(["ec2", "start-instances", "--instance-ids", id]);
    await waitForState("running");
  }
  if (await waitForSite()) console.log(`\nThe site is up: ${site}\nRemember to stop it when you are done: pnpm stage:stop`);
  else console.log(`\nThe server runs, but the site does not answer yet. Look at: pnpm stage:logs\n${site}`);
}

async function stop() {
  if (state() === "stopped") return console.log("The server is already stopped.");
  console.log("Stopping the server...");
  aws(["ec2", "stop-instances", "--instance-ids", id]);
  await waitForState("stopped");
  console.log("Stopped. The data is kept. You now pay only for the address and the disk.");
}

switch (command) {
  case "start":
    await start();
    break;
  case "stop":
    await stop();
    break;
  case "restart":
    await stop();
    await start();
    break;
  case "status": {
    const now = state();
    console.log(`Server ${id}: ${now}`);
    console.log(`Site: ${site}`);
    if (now === "running") console.log("It is running and billed by the hour. Stop it with: pnpm stage:stop");
    break;
  }
  case "logs":
    // The log of the start-up service, and which containers run.
    console.log(await runOnServer(["journalctl -u namma-stage --no-pager -n 80", "docker ps --format '{{.Names}}: {{.Status}}'"]));
    break;
  case "codes":
    await codes(process.argv[3]);
    break;
  case "shell":
    console.log(`Run this (needs the AWS Session Manager plugin):\n\n  aws ssm start-session --region ${REGION} --target ${id}\n`);
    break;
  default:
    fail(`Unknown command "${command}". Use: start, stop, restart, status, logs, codes or shell.`);
}
