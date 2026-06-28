import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const standaloneDir = join(".next", "standalone");

if (!existsSync(standaloneDir)) {
  console.warn("No .next/standalone directory found; skipping standalone asset copy.");
  process.exit(0);
}

const publicTarget = join(standaloneDir, "public");
const nextTarget = join(standaloneDir, ".next");
const staticTarget = join(nextTarget, "static");

rmSync(publicTarget, { recursive: true, force: true });
rmSync(staticTarget, { recursive: true, force: true });

mkdirSync(nextTarget, { recursive: true });

cpSync("public", publicTarget, { recursive: true });
cpSync(join(".next", "static"), staticTarget, { recursive: true });

console.log("Standalone assets copied: public/ and .next/static/.");
