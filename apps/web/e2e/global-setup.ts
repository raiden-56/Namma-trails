import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Creates (or resets) a dedicated E2E super admin with a fresh random password
 * for every run. The password only lives in this process's environment, which
 * Playwright passes to the test workers; it is never written to disk.
 */
export default function globalSetup() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const email = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com";
  const phone = process.env.E2E_ADMIN_PHONE ?? "9000000001";
  const password = `E2e${randomBytes(12).toString("base64url")}7`;

  // Run the compiled admin script with this Node binary directly: no shell, so arguments are passed verbatim.
  execFileSync(
    process.execPath,
    [
      "--env-file-if-exists=.env",
      "dist/prisma/create-admin.js",
      "--phone",
      phone,
      "--name",
      "E2E Super Admin",
      "--role",
      "super_admin",
      "--email",
      email,
      "--password",
      password,
    ],
    { cwd: path.join(repoRoot, "apps/api"), stdio: "pipe" },
  );

  process.env.E2E_ADMIN_EMAIL = email;
  process.env.E2E_ADMIN_PASSWORD = password;
}
