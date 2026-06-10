import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  process.exit(0);
}

const publicDir = join(root, "public");
const staticDir = join(root, ".next", "static");

if (existsSync(publicDir)) {
  cpSync(publicDir, join(standaloneDir, "public"), { recursive: true });
}

if (existsSync(staticDir)) {
  cpSync(staticDir, join(standaloneDir, ".next", "static"), { recursive: true });
}

for (const envFile of [".env", ".env.local", ".env.production", ".env.development"]) {
  rmSync(join(standaloneDir, envFile), { force: true });
}
