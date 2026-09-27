// One-time Supabase setup over HTTPS (Management API): no psql, Docker or Supabase CLI needed.
// Node 18+. Used by docs/COWORK.md; each command is safe to re-run.
//
//   export SUPABASE_ACCESS_TOKEN=sbp_...   # supabase.com/dashboard/account/tokens
//   export SUPABASE_PROJECT_REF=abcd...    # from https://<ref>.supabase.co
//   node scripts/setup-supabase.mjs db                 # migrations + roads
//   node scripts/setup-supabase.mjs migrate            # new migrations only (after an update; keeps roads and posts)
//   node scripts/setup-supabase.mjs auth               # site URL, redirect URLs (+ Google if GOOGLE_CLIENT_ID/SECRET set)
//   node scripts/setup-supabase.mjs cron               # Vault secrets for the 15-minute refresh (prints CRON_SECRET)
//   node scripts/setup-supabase.mjs keys               # env values for Vercel
//   node scripts/setup-supabase.mjs refresh            # run the refresh once (needs CRON_SECRET)
//   node scripts/setup-supabase.mjs admin you@mail.com # make a signed-in user an admin
//   node scripts/setup-supabase.mjs check              # what is set up so far
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.SUPABASE_API_URL ?? 'https://api.supabase.com';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
const SITE = (process.env.SITE_URL ?? 'https://kku-flood-watch.vercel.app').replace(/\/$/, '');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BATCH_BYTES = 500_000; // keep each request well under the API body limit

if (!TOKEN || !REF) {
  console.error('Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF first (see the header of this file).');
  process.exit(1);
}

async function api(method, path, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/v1/projects/${REF}${path}`, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : null;
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, attempt * 5000));
      continue;
    }
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
}
const sql = (query) => api('POST', '/database/query', { query });
const literal = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function migrate() {
  const dir = join(ROOT, 'supabase/migrations');
  const applied = new Set(((await api('GET', '/database/migrations')) ?? []).map((m) => m.name));
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const name = file.replace(/\.sql$/, '');
    if (applied.has(name)) {
      console.log(`= ${name} (already applied)`);
      continue;
    }
    await api('POST', '/database/migrations', { name, query: readFileSync(join(dir, file), 'utf8') });
    console.log(`✓ ${name}`);
  }
}

async function db() {
  await migrate();

  // roads.sql is one 4 MB transaction; send its statements in batches (it starts by deleting, so re-runs are safe).
  const statements = [];
  let current = '';
  for (const line of readFileSync(join(ROOT, 'supabase/seed/roads.sql'), 'utf8').split('\n')) {
    if (line.startsWith('--') || /^(begin|commit);$/.test(line.trim())) continue;
    current += line + '\n';
    if (line.trimEnd().endsWith(';')) {
      statements.push(current);
      current = '';
    }
  }
  if (current.trim()) statements.push(current); // last statement may end in a comment
  let batch = '';
  let sent = 0;
  const flush = async () => {
    if (!batch) return;
    await sql(batch);
    sent += batch.length;
    batch = '';
    process.stdout.write(`\r  roads ${Math.round((sent / totalBytes) * 100)}%`);
  };
  const totalBytes = statements.reduce((n, s) => n + s.length, 0);
  for (const s of statements) {
    if (batch.length + s.length > BATCH_BYTES) await flush();
    batch += s;
  }
  await flush();
  const [c] = await sql(
    'select (select count(*) from road_segments) segments, (select count(*) from road_nodes where routable) routable_nodes',
  );
  console.log(`\n✓ roads: ${c.segments} segments, ${c.routable_nodes} routable nodes`);
}

async function auth() {
  const body = {
    site_url: SITE,
    uri_allow_list: [`${SITE}/auth/callback`, 'http://localhost:3000/auth/callback'].join(','),
  };
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    Object.assign(body, {
      external_google_enabled: true,
      external_google_client_id: process.env.GOOGLE_CLIENT_ID,
      external_google_secret: process.env.GOOGLE_CLIENT_SECRET,
    });
  await api('PATCH', '/config/auth', body);
  console.log(`✓ site URL ${SITE}, redirect ${SITE}/auth/callback${body.external_google_enabled ? ', Google sign-in on' : ''}`);
  console.log(`  OAuth callback to register at Google/LINE: https://${REF}.supabase.co/auth/v1/callback`);
}

async function cron() {
  const secret = process.env.CRON_SECRET || randomBytes(32).toString('hex');
  const upsert = (name, value) => `
    if exists (select 1 from vault.secrets where name = ${literal(name)}) then
      perform vault.update_secret((select id from vault.secrets where name = ${literal(name)}), ${literal(value)});
    else perform vault.create_secret(${literal(value)}, ${literal(name)}); end if;`;
  await sql(`do $$ begin ${upsert('refresh_url', `${SITE}/api/cron/refresh`)} ${upsert('cron_secret', secret)} end $$;`);
  const jobs = await sql("select jobname, schedule from cron.job where jobname = 'refresh-flood-data'");
  console.log(`✓ Vault secrets set; cron job: ${jobs.length ? jobs[0].schedule : 'MISSING (re-run: db)'}`);
  if (!process.env.CRON_SECRET) console.log(`CRON_SECRET=${secret}   ← put this exact value on Vercel`);
}

async function keys() {
  const list = await api('GET', '/api-keys?reveal=true');
  const pick = (...names) => list.find((k) => names.includes(k.type) || names.includes(k.name))?.api_key;
  console.log(`NEXT_PUBLIC_SUPABASE_URL=https://${REF}.supabase.co`);
  console.log(`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${pick('publishable', 'anon')}`);
  console.log(`SUPABASE_SECRET_KEY=${pick('secret', 'service_role')}`);
}

async function refresh() {
  if (!process.env.CRON_SECRET) throw new Error('Set CRON_SECRET (the value from `cron`).');
  const res = await fetch(`${SITE}/api/cron/refresh`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  console.log(res.status, await res.text());
}

async function admin(email) {
  if (!email) throw new Error('Usage: admin you@example.com');
  const match = `lower(u.email) = lower(${literal(email)})`;
  await sql(`update public.profiles p set role = 'admin' from auth.users u where u.id = p.id and ${match}`);
  const rows = await sql(`select 1 from public.profiles p join auth.users u on u.id = p.id where p.role = 'admin' and ${match}`);
  console.log(rows.length ? `✓ ${email} is now an admin` : `✗ no user with ${email}: sign in on ${SITE} once, then re-run`);
}

async function check() {
  const [r] = await sql(`select
    (select count(*) from supabase_migrations.schema_migrations) migrations,
    (select count(*) from public.road_segments) road_segments,
    (select count(*) from public.road_nodes where routable) routable_nodes,
    (select count(*) from cron.job where jobname = 'refresh-flood-data') cron_jobs,
    (select count(*) from vault.secrets where name in ('refresh_url', 'cron_secret')) vault_secrets,
    (select count(*) from public.rainfall) rain_rows,
    (select count(*) from public.profiles) users,
    (select count(*) from public.profiles where role = 'admin') admins`);
  console.table(r);
}

const [cmd, arg] = process.argv.slice(2);
const commands = { db, migrate, auth, cron, keys, refresh, admin, check };
if (!commands[cmd]) {
  console.error(`Commands: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}
commands[cmd](arg).catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
