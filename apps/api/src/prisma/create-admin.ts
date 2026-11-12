/**
 * Bootstraps a platform admin from the command line (there is deliberately no
 * public endpoint for this). The admin signs in with phone OTP, or with email
 * and password when --email is given.
 *
 *   pnpm --filter @kt/api admin:create -- --phone 9876543210 --name "Asha Rao" --role super_admin
 *   pnpm --filter @kt/api admin:create -- --phone 9876543210 --name "Asha Rao" --email asha@example.com
 *
 * With --email and no --password, a strong random password is generated and
 * printed once (keeps passwords out of shell history). Re-running with --email
 * resets that admin's password.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PLATFORM_ROLES, indianMobile, password as passwordSchema } from "@kt/domain";
import { z } from "zod";
import { PrismaClient } from "../generated/prisma/client.js";
import { hashPassword } from "../modules/auth/password.js";

// pnpm forwards a literal "--" separator; drop it so both `admin:create -- --phone …` and `admin:create --phone …` work.
const argv = process.argv.slice(2);
const { values } = parseArgs({
  args: argv[0] === "--" ? argv.slice(1) : argv,
  options: {
    phone: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "super_admin" },
    email: { type: "string" },
    password: { type: "string" },
  },
});
const phone = indianMobile.parse(values.phone ?? "");
const role = values.role ?? "super_admin";
if (!(PLATFORM_ROLES as readonly string[]).includes(role) || role === "traveler") throw new Error(`Unknown admin role: ${role}`);
if (!values.name) throw new Error("--name is required");
const email = values.email ? z.email().parse(values.email.trim().toLowerCase()) : undefined;
if (values.password && !email) throw new Error("--password requires --email");

/** 16 random characters from an unambiguous alphabet, always including letters and digits. */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  for (;;) {
    const bytes = randomBytes(16);
    const pw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) return pw;
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

try {
  const user =
    (await prisma.user.findUnique({ where: { phone } })) ??
    (await prisma.user.create({ data: { phone, phoneVerified: new Date(), profile: { create: { fullName: values.name } }, roles: { create: { role: { connect: { key: "traveler" } } } } } }));
  // Keep the display name in sync with --name (the account may pre-exist from an OTP sign-in).
  await prisma.userProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, fullName: values.name }, update: { fullName: values.name } });
  const roleRow = await prisma.role.findUniqueOrThrow({ where: { key: role } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: roleRow.id } }, create: { userId: user.id, roleId: roleRow.id }, update: {} });
  await prisma.auditLog.create({ data: { actorType: "system", action: "admin.role.grant", entityType: "user", entityId: user.id, after: { role } } });
  console.log(`Granted ${role} to ${phone} (user ${user.id}).`);

  if (email) {
    const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (owner && owner.id !== user.id) throw new Error(`${email} already belongs to another account`);
    const generated = !values.password;
    const plain = values.password ? passwordSchema.parse(values.password) : generatePassword();
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { email, emailVerified: new Date(), passwordHash: await hashPassword(plain) } }),
      // A credential change ends existing sessions.
      prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({ data: { actorType: "system", action: "admin.credentials.set", entityType: "user", entityId: user.id, after: { email } } }),
    ]);
    console.log(`Email sign-in enabled: ${email}`);
    if (generated) console.log(`Generated password (shown once, store it safely): ${plain}`);
  } else {
    console.log("Sign in with phone OTP.");
  }
} finally {
  await prisma.$disconnect();
}
