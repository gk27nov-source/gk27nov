#!/usr/bin/env node
/**
 * Assign organizationId and role custom claims to a user.
 *
 * Nothing in this backend works without these claims: the API returns 403 and
 * the Firestore rules deny every read. Run this once per user.
 *
 * Setup:
 *   1. Firebase console -> Project settings -> Service accounts
 *      -> Generate new private key. Save it OUTSIDE the repo.
 *   2. export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json
 *
 * Usage:
 *   node scripts/set-claims.mjs <email> <organizationId> <role>
 *   node scripts/set-claims.mjs --list <organizationId>
 *
 * Roles: viewer | staff | manager | business_admin | super_admin
 *
 * The user must sign out and back in (or the client must call
 * getIdToken(true)) before new claims take effect — claims are baked into the
 * ID token at issue time.
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const ROLES = ["viewer", "staff", "manager", "business_admin", "super_admin"];

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS is not set. See the header of this file.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const auth = getAuth();

const args = process.argv.slice(2);

if (args[0] === "--list") {
  const orgId = args[1];
  let pageToken;
  let count = 0;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      const c = u.customClaims ?? {};
      if (orgId && c.organizationId !== orgId) continue;
      console.log(
        [
          u.uid.padEnd(30),
          (u.email ?? "—").padEnd(34),
          (c.organizationId ?? "NO ORG").padEnd(22),
          c.role ?? "NO ROLE",
        ].join(" ")
      );
      count++;
    }
    pageToken = page.pageToken;
  } while (pageToken);
  console.log(`\n${count} user(s).`);
  process.exit(0);
}

const [email, organizationId, role] = args;

if (!email || !organizationId || !role) {
  console.error("Usage: node scripts/set-claims.mjs <email> <organizationId> <role>");
  console.error(`Roles: ${ROLES.join(" | ")}`);
  process.exit(1);
}

if (!ROLES.includes(role)) {
  console.error(`Unknown role '${role}'. Use one of: ${ROLES.join(", ")}`);
  process.exit(1);
}

const user = await auth.getUserByEmail(email);
const existing = user.customClaims ?? {};

await auth.setCustomUserClaims(user.uid, { ...existing, organizationId, role });

console.log(`Set claims for ${email} (${user.uid}):`);
console.log(`  organizationId = ${organizationId}`);
console.log(`  role           = ${role}`);
console.log("\nThe user must sign out and in again, or the client must call");
console.log("getIdToken(true), before the new token carries these claims.");
