import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "wrangler.jsonc",
  "src/index.js"
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing ${file}`);
  }
}

const worker = await import(pathToFileURL(path.join(root, "src/index.js")).href);

if (typeof worker.default?.fetch !== "function") {
  throw new Error("src/index.js must export a default fetch handler");
}

console.log("monitor-dashboard smoke check passed");
