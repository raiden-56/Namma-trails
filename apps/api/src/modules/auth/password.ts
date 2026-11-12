import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations).
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password).catch(() => false);
}
