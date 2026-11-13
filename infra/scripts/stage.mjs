#!/usr/bin/env node
// Switches the stage server on and off. Run it from the infra folder:
//
//   pnpm stage:start     start the server and wait until the site answers
//   pnpm stage:stop      stop it (you then pay only for its address and disk)
//   pnpm stage:status    is it running, and what is its address
//   pnpm stage:restart   stop and start: needed after `cdk deploy` to run the new version
//   pnpm stage:logs      what the server printed while starting the app
//   pnpm stage:shell     prints the command that opens a shell on the server
//
// It uses the AWS CLI with your own login, and reads the server's id from the stack.
import { execFileSync } from "node:child_process";

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
  case "logs": {
    // Asks the server for the log of its start-up service, through Systems Manager.
    const sent = JSON.parse(
      aws(["ssm", "send-command", "--instance-ids", id, "--document-name", "AWS-RunShellScript", "--parameters", JSON.stringify({ commands: ["journalctl -u namma-stage --no-pager -n 80", "docker ps --format '{{.Names}}: {{.Status}}'"] })]),
    );
    await sleep(4000);
    const result = JSON.parse(aws(["ssm", "get-command-invocation", "--command-id", sent.Command.CommandId, "--instance-id", id]));
    console.log(result.StandardOutputContent || result.StandardErrorContent || `(${result.Status})`);
    break;
  }
  case "shell":
    console.log(`Run this (needs the AWS Session Manager plugin):\n\n  aws ssm start-session --region ${REGION} --target ${id}\n`);
    break;
  default:
    fail(`Unknown command "${command}". Use: start, stop, restart, status, logs or shell.`);
}
