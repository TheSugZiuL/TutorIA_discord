import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";

export function pathFromRoot(...segments: string[]): string {
  return resolve(process.cwd(), ...segments);
}

export function ensureDirectory(directoryPath: string): void {
  if (!existsSync(directoryPath)) {
    mkdirSync(directoryPath, { recursive: true });
  }
}

export function ensureFile(filePath: string, defaultContent: string): void {
  ensureDirectory(dirname(filePath));

  if (!existsSync(filePath)) {
    writeFileSync(filePath, withFinalNewline(defaultContent), "utf-8");
  }
}

export function readTextFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

export function writeTextFile(
  filePath: string,
  content: string,
  options?: { backup?: boolean }
): void {
  ensureDirectory(dirname(filePath));

  if (options?.backup && existsSync(filePath)) {
    backupFile(filePath);
  }

  writeFileSync(filePath, withFinalNewline(content), "utf-8");
}

export function appendTextFile(
  filePath: string,
  content: string,
  options?: { backup?: boolean }
): void {
  ensureDirectory(dirname(filePath));

  if (options?.backup && existsSync(filePath)) {
    backupFile(filePath);
  }

  appendFileSync(filePath, withLeadingAndFinalNewline(content), "utf-8");
}

export function backupFile(
  filePath: string,
  backupDirectory = pathFromRoot("context-backups")
): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  ensureDirectory(backupDirectory);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = extname(filePath);
  const name = basename(filePath, extension);
  const backupPath = resolve(
    backupDirectory,
    `${name}-${timestamp}${extension || ".bak"}`
  );

  copyFileSync(filePath, backupPath);

  return backupPath;
}

function withFinalNewline(content: string): string {
  const trimmedRight = content.trimEnd();
  return `${trimmedRight}\n`;
}

function withLeadingAndFinalNewline(content: string): string {
  const normalized = withFinalNewline(content);
  return normalized.startsWith("\n") ? normalized : `\n${normalized}`;
}
