import archiver from "archiver";
import { createWriteStream, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "Info.json"), "utf8"));
const packageMetadata = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const packageName = packageMetadata.name;
const releaseDir = resolve(root, "release");
const archivePath = resolve(releaseDir, `${packageName}-${manifest.version}.iinaplgz`);

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

await new Promise((resolveArchive, reject) => {
  const output = createWriteStream(archivePath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", resolveArchive);
  output.on("error", reject);
  archive.on("error", reject);
  archive.pipe(output);
  archive.glob("**/*", {
    cwd: root,
    dot: true,
    ignore: [
      ".git/**",
      ".claude/**",
      ".parcel-cache/**",
      "node_modules/**",
      "release/**",
      "*.iinaplgz",
      "*.iinaplugin-dev",
    ],
  });
  archive.finalize();
});

console.log(`Created ${archivePath}`);
