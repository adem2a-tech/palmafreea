import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "artifacts/palma-fa/dist/public");
const dest = path.join(root, "public");

await rm(dest, { recursive: true, force: true });
await cp(src, dest, { recursive: true });
console.log(`[vercel] SPA copiée : ${src} → ${dest}`);
