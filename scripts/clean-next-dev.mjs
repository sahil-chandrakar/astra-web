import { existsSync, rmSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const devCache = resolve(projectRoot, ".next");
const expectedPrefix = `${projectRoot}${sep}`;

if (!devCache.startsWith(expectedPrefix) || devCache === projectRoot) {
  throw new Error(`Refusing to remove unexpected path: ${devCache}`);
}

if (existsSync(devCache)) {
  rmSync(devCache, { recursive: true, force: true });
  console.log("Removed stale Next dev cache: .next");
}
