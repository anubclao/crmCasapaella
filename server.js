/**
 * Local dev entry point.
 *
 * - Dev (NODE_ENV != production): spawns `next dev` and streams its output.
 * - Production: prepare-deploy.mjs produces ./dist/server.js with the env
 *   wrapper prepended. The hosted entry should be `dist/server.js`, not this.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

if (process.env.NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.log(
    "In production, run: node dist/server.js\n" +
      "Build it first with: npm run deploy:prepare"
  );
  process.exit(1);
}

// Invoke next's JS entry directly via node — avoids Node 24's spawn EINVAL
// on Windows .cmd shims and skips the deprecation warning from shell:true.
const nextBin = path.join(__dirname, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, "dev"], {
  stdio: "inherit",
  env: { ...process.env, FORCE_COLOR: "1" },
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill(sig);
    process.exit(0);
  });
}

child.on("exit", (code) => process.exit(code ?? 0));
