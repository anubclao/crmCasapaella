/**
 * Build the deployable bundle for Hostinger Shared.
 *
 * Steps:
 *   1. Run `next build` (produces .next/standalone + .next/static).
 *   2. Copy .next/standalone → ./dist
 *   3. Copy .next/static → dist/.next/static (standalone only has the server).
 *   4. Copy auth_artifacts/ if it exists (Baileys session).
 *   5. Prepend an env-loader + signal-handler wrapper to dist/server.js so
 *      it loads .env.production on startup.
 *   6. (Windows + Node 24 only) Copy missing webpack runtime chunks.
 *
 * Upload the entire ./dist directory to Hostinger via File Manager or FTP.
 * Set the entry point in hPanel to `dist/server.js`.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const SRC_SERVER = ".next/standalone/server.js";

function run(cmd, args, opts = {}) {
  // eslint-disable-next-line no-console
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed with code ${r.status}`);
}

function ensureClean() {
  if (existsSync(DIST)) {
    rmSync(DIST, { recursive: true, force: true });
  }
  mkdirSync(DIST, { recursive: true });
}

function copyStandalone() {
  if (!existsSync(".next/standalone")) {
    throw new Error("Run `npm run build` first. .next/standalone is missing.");
  }
  // Copy standalone root, but exclude the .next inside (we add it ourselves
  // with static + required-server-files).
  cpSync(".next/standalone", DIST, { recursive: true });

  // Standalone includes a minimal .next/ (server only). Add static chunks.
  if (existsSync(".next/static")) {
    cpSync(".next/static", join(DIST, ".next/static"), { recursive: true });
  }
  // Some chunks (manifest, build-traces) live in .next/required-server-files.json
  // and are referenced by the standalone server.js.
  if (existsSync(".next/required-server-files.json")) {
    copyFileSync(".next/required-server-files.json", join(DIST, ".next/required-server-files.json"));
  }
}

function copyAuthArtifacts() {
  if (existsSync("auth_artifacts")) {
    cpSync("auth_artifacts", join(DIST, "auth_artifacts"), { recursive: true });
  }
}

function copyNodeModulesFixes() {
  // Windows + Node 24: webpack/bundle5.js sometimes missing in standalone.
  // Defensive copy of the full compiled/ tree.
  const compiledSrc = "node_modules/next/dist/compiled";
  const compiledDst = join(DIST, "node_modules/next/dist/compiled");
  if (existsSync(compiledSrc) && existsSync(join(DIST, "node_modules/next/dist"))) {
    try {
      cpSync(compiledSrc, compiledDst, { recursive: true });
      // eslint-disable-next-line no-console
      console.log("✓ defensive copy of next/dist/compiled");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("⚠ could not copy next/dist/compiled:", e.message);
    }
  }
}

function prependEnvLoader() {
  const target = join(DIST, "server.js");
  if (!existsSync(target)) {
    throw new Error(`Expected ${target} after copy. Run \`next build\` first.`);
  }
  const original = readFileSync(target, "utf8");
  const wrapper = `// ── env loader wrapper (injected by prepare-deploy.mjs) ──
const fs = require('node:fs');

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, 'utf8');
  for (const line of content.split(/\\r?\\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.production');
loadEnvFile('.env');

// Normalize localhost → 127.0.0.1 to dodge Hostinger IPv6 grants issue.
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/@localhost(?=[:/])/, '@127.0.0.1');
}

if (process.env.DATABASE_URL && fs.existsSync('.next/required-server-files.json')) {
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = fs.readFileSync('.next/required-server-files.json', 'utf8');
}

// Graceful shutdown
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { process.exit(0); });
}

`;

  writeFileSync(target, wrapper + original, "utf8");
  const stat = statSync(target);
  // eslint-disable-next-line no-console
  console.log(`✓ prepended env loader to ${target} (${stat.size} bytes)`);
}

function ensureEnvExample() {
  // Help the operator: copy .env.example → .env.production in dist if not present.
  const distEnv = join(DIST, ".env.production");
  if (!existsSync(distEnv) && existsSync(".env.example")) {
    copyFileSync(".env.example", distEnv);
    // eslint-disable-next-line no-console
    console.log("✓ copied .env.example → dist/.env.production (operator must fill in real values)");
  }
}

// ── main ────────────────────────────────────────────────────────────────
ensureClean();
run("npx", ["next", "build"]);
copyStandalone();
copyAuthArtifacts();
copyNodeModulesFixes();
prependEnvLoader();
ensureEnvExample();

// eslint-disable-next-line no-console
console.log("\n✅ Deploy bundle ready in ./dist");
console.log("   Next steps:");
console.log("   1. Upload ./dist/* to your Hostinger file manager");
console.log("   2. In hPanel → Node.js, set entry to dist/server.js");
console.log("   3. Edit dist/.env.production with your real DATABASE_URL and AUTH_SECRET");
console.log("   4. Run the SQL in drizzle/0000_init.sql via phpMyAdmin");
console.log("   5. Start the app from hPanel → Node.js → Restart");
