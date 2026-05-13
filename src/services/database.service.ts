import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getSqliteDatabasePath } from "../config/env.js";
import { ensureDirectory, pathFromRoot } from "../utils/file.util.js";
import type { StorageFileKey } from "../types/index.js";

interface DocumentRow {
  content: string;
}

interface DatabaseStatusRow {
  document_count: number;
  backup_count: number;
}

let database: DatabaseSync | null = null;

export function getDatabaseFilePath(): string {
  const configuredPath = getSqliteDatabasePath();
  return isAbsolute(configuredPath)
    ? configuredPath
    : resolve(process.cwd(), configuredPath);
}

export function ensureDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  const databasePath = getDatabaseFilePath();
  ensureDirectory(dirname(databasePath));

  database = new DatabaseSync(databasePath, {
    timeout: 5000
  });

  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS documents (
      key TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS document_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_key TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_key) REFERENCES documents(key)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_document_backups_document_key_created_at
      ON document_backups(document_key, created_at);
  `);

  return database;
}

export function readDocument(key: StorageFileKey): string | null {
  const row = ensureDatabase()
    .prepare("SELECT content FROM documents WHERE key = ?")
    .get(key) as DocumentRow | undefined;

  return row?.content ?? null;
}

export function upsertDocument(
  key: StorageFileKey,
  filename: string,
  content: string,
  options?: { backup?: boolean }
): void {
  const db = ensureDatabase();

  if (options?.backup) {
    const currentContent = readDocument(key);

    if (currentContent) {
      db.prepare(
        "INSERT INTO document_backups (document_key, content, created_at) VALUES (?, ?, ?)"
      ).run(key, currentContent, new Date().toISOString());
    }
  }

  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO documents (key, filename, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       filename = excluded.filename,
       content = excluded.content,
       updated_at = excluded.updated_at`
  ).run(key, filename, content.trimEnd() + "\n", now, now);
}

export function getDatabaseStatus(): {
  path: string;
  exists: boolean;
  documentCount: number;
  backupCount: number;
} {
  const databasePath = getDatabaseFilePath();
  const row = ensureDatabase()
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM documents) AS document_count,
        (SELECT COUNT(*) FROM document_backups) AS backup_count`
    )
    .get() as unknown as DatabaseStatusRow;

  return {
    path: databasePath,
    exists: existsSync(databasePath),
    documentCount: row.document_count,
    backupCount: row.backup_count
  };
}

export function closeDatabase(): void {
  if (!database) {
    return;
  }

  database.close();
  database = null;
}
