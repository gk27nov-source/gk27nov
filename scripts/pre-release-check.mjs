#!/usr/bin/env node
/**
 * Repository and secret-hygiene safety gate for a production release.
 *
 * This script checks the REPOSITORY, not the application. It answers "is it
 * safe to cut a release from what's sitting in this working tree right now",
 * not "does the application work" — that is `npm run verify`'s job (lint +
 * test + build). Run them together with:
 *
 *   npm run release:check
 *
 * which is `node scripts/pre-release-check.mjs && npm run verify`. Deliberately
 * two separate steps rather than one script that does both: this file owns
 * git/secret hygiene, `verify` owns application correctness, and neither
 * duplicates the other's logic.
 *
 * This script never prints a secret value. Where a check needs to know
 * WHETHER something is set, it reports presence/absence or a boolean
 * conclusion — never the value itself.
 *
 * Exit code 0 = every check passed (warnings are allowed through).
 * Exit code 1 = at least one check failed.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const CANONICAL_REPO = process.env.RELEASE_CANONICAL_REPO || 'gk27nov-source/gk27nov';
const EXPECTED_BRANCH = process.env.RELEASE_BRANCH || 'main';

/** Known-valid values, kept in sync with server/config.ts's N8nAuthType union by hand. */
const VALID_N8N_AUTH_TYPES = ['none', 'header', 'bearer', 'basic', 'hmac'];

let failed = 0;
let warned = 0;

function section(title) {
  console.log(`\n${title}`);
}
function ok(msg) {
  console.log(`  ok    ${msg}`);
}
function fail(msg) {
  failed++;
  console.log(`  FAIL  ${msg}`);
}
function warn(msg) {
  warned++;
  console.log(`  WARN  ${msg}`);
}

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function gitOrNull(cmd) {
  try {
    return git(cmd);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
section('Repository identity');
// ---------------------------------------------------------------------------

const insideRepo = gitOrNull('rev-parse --is-inside-work-tree');
if (insideRepo !== 'true') {
  fail(`${ROOT} is not a git repository. Run this from the project root.`);
  console.log(`\n${failed} check(s) failed, ${warned} warning(s).`);
  process.exit(1);
}

const remotes = git('remote -v')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [name, rest] = line.split('\t');
    const [url, kind] = rest.split(' ');
    return { name, url, kind: kind.replace(/[()]/g, '') };
  });

const canonicalRemote = remotes.find(
  (r) => r.kind === 'fetch' && r.url.toLowerCase().includes(CANONICAL_REPO.toLowerCase())
);

if (canonicalRemote) {
  ok(`canonical repository "${CANONICAL_REPO}" found on remote "${canonicalRemote.name}"`);
} else {
  fail(
    `no remote points at "${CANONICAL_REPO}". Configured remotes: ${remotes
      .filter((r) => r.kind === 'fetch')
      .map((r) => `${r.name} -> ${r.url}`)
      .join(', ') || '(none)'}`
  );
}

const otherRemotes = remotes.filter((r) => r.kind === 'fetch' && r !== canonicalRemote);
for (const r of otherRemotes) {
  warn(`remote "${r.name}" (${r.url}) is not the canonical repository — do not release through it`);
}

// ---------------------------------------------------------------------------
section('Branch and working tree');
// ---------------------------------------------------------------------------

const currentBranch = gitOrNull('rev-parse --abbrev-ref HEAD');
if (currentBranch === 'HEAD') {
  fail('repository is in a detached HEAD state — check out a branch before releasing');
} else if (currentBranch === EXPECTED_BRANCH) {
  ok(`current branch is "${currentBranch}", matching expected release branch`);
} else {
  fail(
    `current branch is "${currentBranch}", expected "${EXPECTED_BRANCH}" ` +
      `(override with RELEASE_BRANCH=<branch> if this is intentional)`
  );
}

const currentHead = gitOrNull('rev-parse HEAD');
ok(`HEAD is ${currentHead}`);

const porcelain = git('status --porcelain');
if (porcelain === '') {
  ok('working tree is clean');
} else {
  fail('working tree is not clean — uncommitted changes present:');
  for (const line of porcelain.split('\n')) console.log(`          ${line}`);
}

const mergeHeadPath = join(ROOT, '.git', 'MERGE_HEAD');
const hasUnmerged = porcelain.split('\n').some((l) => /^(UU|AA|DD|AU|UA|UD|DU)\s/.test(l));
if (existsSync(mergeHeadPath) || hasUnmerged) {
  fail('an unresolved merge is in progress (MERGE_HEAD present or unmerged paths listed above)');
} else {
  ok('no unresolved merge conflicts');
}

// ---------------------------------------------------------------------------
section('Tracked-file hygiene');
// ---------------------------------------------------------------------------

const trackedFiles = git('ls-files').split('\n').filter(Boolean);

const trackedEnvFiles = trackedFiles.filter(
  (f) => /(^|\/)\.env(\..+)?$/.test(f) && !f.endsWith('.env.example') && !f.endsWith('.env.demo.example')
);
if (trackedEnvFiles.length === 0) {
  ok('no .env / .env.local / .env.production files are tracked');
} else {
  fail(`tracked env file(s) that must never be committed: ${trackedEnvFiles.join(', ')}`);
}

const secretShapedFiles = trackedFiles.filter((f) =>
  /(firebase-adminsdk|service-?account|serviceaccount|\.pem$|\.p12$|\.key$)/i.test(f)
);
if (secretShapedFiles.length === 0) {
  ok('no service-account/private-key-shaped filenames are tracked');
} else {
  fail(`tracked file(s) shaped like credentials: ${secretShapedFiles.join(', ')}`);
}

// ---------------------------------------------------------------------------
section('Credential-pattern scan (staged + committed changes since expected branch diverged)');
// ---------------------------------------------------------------------------

// Heuristic, not exhaustive: catches the shapes that have actually shown up
// in this codebase's history (fake-looking-but-secret-shaped API key
// literals, private key headers), not a general-purpose secret scanner.
const CREDENTIAL_PATTERNS = [
  { name: 'PEM private key header', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Firebase/GCP service-account JSON shape', re: /"type"\s*:\s*"service_account"/ },
  { name: 'AWS access key id shape', re: /AKIA[0-9A-Z]{16}/ },
  {
    name: 'hardcoded secret-shaped literal assigned to a key/secret/token field',
    re: /(apiKey|api_key|secret|token|password)['"]?\s*[:=]\s*['"][A-Za-z0-9_\-]{10,}['"]/i,
  },
];

const staged = gitOrNull('diff --cached') || '';
const lastCommit = gitOrNull('show --format= HEAD') || '';
const scanTargets = [
  { label: 'staged changes', text: staged },
  { label: 'last commit (HEAD)', text: lastCommit },
];

let credentialHits = 0;
for (const target of scanTargets) {
  if (!target.text) continue;
  const addedLines = target.text.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  for (const { name, re } of CREDENTIAL_PATTERNS) {
    const hit = addedLines.find((l) => re.test(l));
    if (hit) {
      credentialHits++;
      fail(`possible ${name} found in ${target.label} — value not printed, review manually`);
    }
  }
}
if (credentialHits === 0) {
  ok('no known credential shapes found in staged changes or the last commit');
}

// ---------------------------------------------------------------------------
section('Webhook destination hygiene (tracked source)');
// ---------------------------------------------------------------------------

// Deliberately narrow: only flags a literal URL actually ASSIGNED to a
// webhook-destination-shaped field (targetWebhookUrl: '...', N8N_WEBHOOK_URL
// = '...', etc). A plain substring grep for "localhost" or "/webhook-test/"
// across the tree is far too noisy here — this codebase's own dev-server
// conflict detector, its LOCAL_HOSTS allowlist, and its TEST-url warning
// copy all legitimately mention those strings without being a hardcoded
// destination. Read in pure JS (not `git grep`) so behavior is identical on
// Windows and in CI, with no shell-quoting differences to worry about.
const EXCLUDE_FROM_URL_SCAN = [
  /\.md$/i,
  /^tests\//,
  /^\.env\.example$/,
  /^\.env\.demo\.example$/,
  /selftest\.ts$/,
  /\.test\.(ts|mts|js|mjs)$/,
  /^playwright\.config\.ts$/,
];
const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const WEBHOOK_FIELD_RE =
  /\b(targetWebhookUrl|webhookUrl|n8nWebhookUrl|N8N_WEBHOOK_URL|N8N_WEBHOOK_BASE_URL)\b\s*[:=]\s*(['"])([^'"]*)\2/;

function readTrackedFile(f) {
  try {
    return readFileSync(join(ROOT, f), 'utf8');
  } catch {
    return '';
  }
}

const webhookFieldHits = [];
for (const f of trackedFiles) {
  if (!SOURCE_EXTENSIONS.test(f)) continue;
  if (EXCLUDE_FROM_URL_SCAN.some((re) => re.test(f))) continue;
  const text = readTrackedFile(f);
  if (!text) continue;
  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return; // comments, not code
    const m = line.match(WEBHOOK_FIELD_RE);
    if (m) webhookFieldHits.push({ file: f, lineNo: i + 1, value: m[3], line: trimmed });
  });
}

function reportWebhookFieldValues(label, valueLooksBad) {
  const matches = webhookFieldHits.filter((h) => valueLooksBad(h.value));
  if (matches.length === 0) {
    ok(`no hardcoded ${label} assigned as a webhook destination in tracked source`);
  } else {
    fail(`hardcoded ${label} assigned as a webhook destination in tracked source:`);
    for (const h of matches) console.log(`          ${h.file}:${h.lineNo}: ${h.line}`);
  }
}

reportWebhookFieldValues('localhost URL', (v) => /^https?:\/\/localhost([:/]|$)/i.test(v));
reportWebhookFieldValues('127.0.0.1 URL', (v) => v.includes('127.0.0.1'));
reportWebhookFieldValues('/webhook-test/ URL', (v) => v.includes('/webhook-test/'));

// ---------------------------------------------------------------------------
section('Local .env production-safety (informational — .env is gitignored and never released)');
// ---------------------------------------------------------------------------

const envPath = join(ROOT, '.env');
if (!existsSync(envPath)) {
  ok('no local .env present — nothing to check here; the build environment controls these at build time');
} else {
  const envText = readFileSync(envPath, 'utf8');
  const envVars = {};
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }

  if ((envVars.VITE_DEMO_MODE || '').toLowerCase() === 'true') {
    fail('local .env has VITE_DEMO_MODE=true — do not release a build made with this .env active');
  } else {
    ok('local .env does not enable VITE_DEMO_MODE');
  }

  const authType = envVars.N8N_AUTH_TYPE || 'none';
  if (VALID_N8N_AUTH_TYPES.includes(authType)) {
    ok(`local .env N8N_AUTH_TYPE="${authType}" is a recognized value`);
  } else {
    fail(
      `local .env N8N_AUTH_TYPE="${authType}" is not one of: ${VALID_N8N_AUTH_TYPES.join(', ')}`
    );
  }

  // Presence-only, never the value.
  const secretRequired = ['header', 'bearer', 'hmac'].includes(authType);
  if (secretRequired) {
    if (envVars.N8N_SECRET) {
      ok(`N8N_AUTH_TYPE="${authType}" and N8N_SECRET is set (value not checked here)`);
    } else {
      warn(`N8N_AUTH_TYPE="${authType}" but N8N_SECRET is not set in local .env — dispatch will refuse`);
    }
  }
  if (authType === 'basic') {
    if (envVars.N8N_BASIC_USER && envVars.N8N_BASIC_PASSWORD) {
      ok('N8N_AUTH_TYPE="basic" and both N8N_BASIC_USER / N8N_BASIC_PASSWORD are set');
    } else {
      warn('N8N_AUTH_TYPE="basic" but N8N_BASIC_USER / N8N_BASIC_PASSWORD are incomplete in local .env');
    }
  }
}

// ---------------------------------------------------------------------------
section('Summary');
// ---------------------------------------------------------------------------

console.log(`\n${failed} check(s) failed, ${warned} warning(s).`);
if (failed > 0) {
  console.log('Repository is NOT safe to release. Fix the FAIL items above and re-run.');
  process.exit(1);
}
console.log('Repository safety checks passed. Run `npm run verify` next (or `npm run release:check` to do both).');
process.exit(0);
