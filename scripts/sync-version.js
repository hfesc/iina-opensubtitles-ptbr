import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || "")) {
  throw new Error("Usage: node scripts/sync-version.js <semver>");
}

const manifestPath = resolve("Info.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
manifest.ghVersion = Number(manifest.ghVersion || 0) + 1;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
