import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "_headers",
  "functions/api/ingest.js",
  "functions/api/status.js",
  "functions/api/login.js",
  "functions/api/logout.js",
  "functions/api/me.js"
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing ${file}`);
  }
}

for (const file of requiredFiles.filter((name) => name.startsWith("functions/"))) {
  const module = await import(pathToFileURL(path.join(root, file)).href);

  if (typeof module.onRequest !== "function") {
    throw new Error(`${file} must export onRequest`);
  }
}

console.log("monitor-dashboard smoke check passed");
