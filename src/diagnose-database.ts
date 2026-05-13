import { ensureStorageFiles, readStorageFile } from "./services/context.service.js";
import { getDatabaseStatus } from "./services/database.service.js";

ensureStorageFiles();

const status = getDatabaseStatus();

console.log("SQLite status:");
console.log("PATH:", status.path);
console.log("EXISTS:", status.exists);
console.log("DOCUMENTS:", status.documentCount);
console.log("BACKUPS:", status.backupCount);
console.log("");
console.log("Storage documents:");
console.log("- project-context.md:", readStorageFile("projectContext").length, "chars");
console.log("- decisions.md:", readStorageFile("decisions").length, "chars");
console.log("- tasks.md:", readStorageFile("tasks").length, "chars");
console.log("- errors.md:", readStorageFile("errors").length, "chars");
console.log(
  "- learning-progress.md:",
  readStorageFile("learningProgress").length,
  "chars"
);
