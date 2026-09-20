/**
 * Seeds the platform super admin in Auth + platform_admins.
 * Usage: npm run seed:platform-admin
 *
 * Requires in .env:
 *   PLATFORM_ADMIN_EMAILS=voce@empresa.com
 *   PLATFORM_ADMIN_PASSWORD=senha-forte   (só se o user ainda não existir)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch {
      // file optional
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const emails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const password = process.env.PLATFORM_ADMIN_PASSWORD ?? "";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (emails.length === 0) {
  console.error("Set PLATFORM_ADMIN_EMAILS in .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  // Paginate a bit — fine for bootstrap
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function seedOne(email) {
  let user = await findUserByEmail(email);

  if (!user) {
    if (!password || password.length < 6) {
      throw new Error(
        `User ${email} does not exist. Set PLATFORM_ADMIN_PASSWORD (min 6) in .env and re-run.`,
      );
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Platform Admin" },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created auth user: ${email}`);
  } else {
    console.log(`Auth user already exists: ${email}`);
    if (password && password.length >= 6) {
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      });
      if (error) throw error;
      console.log("Password updated from PLATFORM_ADMIN_PASSWORD");
    }
  }

  // Wait for handle_new_user trigger (profile)
  await new Promise((r) => setTimeout(r, 400));

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    email,
    full_name: user.user_metadata?.full_name ?? "Platform Admin",
  });
  if (profileError) throw profileError;

  const { error: paError } = await admin
    .from("platform_admins")
    .upsert({ user_id: user.id });
  if (paError) throw paError;

  console.log(`platform_admins OK → ${email} (${user.id})`);
}

async function main() {
  for (const email of emails) {
    await seedOne(email);
  }
  console.log("Done. Login at /login with that email.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
