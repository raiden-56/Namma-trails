// Container entrypoint for the API image (see Dockerfile).
//
// On AWS the database password lives in Secrets Manager as separate fields (host, port,
// username, password, dbname). ECS injects them as DB_* variables. The API and Prisma want
// one DATABASE_URL, so it is built here, with the user name and password safely encoded.
//
// If DATABASE_URL is already set (local runs), it is left alone.
//
// Usage: node docker-entrypoint.mjs <command> [args...]
import { spawn } from "node:child_process";

const env = process.env;

if (!env.DATABASE_URL && env.DB_HOST) {
  const user = encodeURIComponent(env.DB_USERNAME ?? "");
  const password = encodeURIComponent(env.DB_PASSWORD ?? "");
  const port = env.DB_PORT ?? "5432";
  const name = env.DB_NAME ?? "postgres";
  // verify-full: encrypt, and check the server certificate (Amazon RDS turns SSL on by default).
  const sslMode = env.DB_SSL_MODE ?? "verify-full";
  env.DATABASE_URL = `postgresql://${user}:${password}@${env.DB_HOST}:${port}/${name}?schema=public&sslmode=${sslMode}`;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("docker-entrypoint: no command given");
  process.exit(64);
}

const child = spawn(command, args, { stdio: "inherit", env });

// Pass stop signals on, so the API can finish open requests before the task stops.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(`docker-entrypoint: could not start "${command}": ${error.message}`);
  process.exit(127);
});
child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
