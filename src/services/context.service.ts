import { existsSync, copyFileSync } from "node:fs";
import { dirname } from "node:path";
import type { StorageFileKey } from "../types/index.js";
import {
  ensureDirectory,
  ensureFile,
  pathFromRoot,
  readTextFile,
  writeTextFile
} from "../utils/file.util.js";
import {
  createMarkdownSummary,
  stripMarkdownCodeFence,
  truncateMarkdown
} from "../utils/markdown.util.js";

export const storagePaths: Record<StorageFileKey, string> = {
  projectContext: pathFromRoot("src", "storage", "project-context.md"),
  decisions: pathFromRoot("src", "storage", "decisions.md"),
  tasks: pathFromRoot("src", "storage", "tasks.md"),
  errors: pathFromRoot("src", "storage", "errors.md"),
  learningProgress: pathFromRoot("src", "storage", "learning-progress.md")
};

const legacyProjectContextPath = pathFromRoot("src", "project-context.md");

const defaultStorageContents: Record<StorageFileKey, string> = {
  projectContext: `# Contexto do Projeto

## Status atual
Ainda não decidimos o projeto.

Estamos usando este bot como um Tutor de Programação para ajudar dois amigos a escolherem, planejarem e desenvolverem um projeto real de um jogo.

## Objetivo
Aprender programação criando um projeto real em dupla.

## Perfil dos participantes
- Participante 1: Luiz Gustavo
- Participante 2: Daniel

## Ideias consideradas
Nenhuma ideia definida ainda.

## Ideia escolhida
Ainda não definida.

## Stack provável
Ainda não definida.

Possibilidades:
- Java
- Bibliotecas para jogos em Java

## Regras
- Começar simples
- Priorizar MVP
- Evitar overengineering
- Documentar decisões
- Aprender durante o desenvolvimento
`,
  decisions: `# Decisões do Projeto

Nenhuma decisão registrada ainda.
`,
  tasks: `# Tarefas do Projeto

Nenhuma tarefa registrada ainda.
`,
  errors: `# Histórico de Erros

Nenhum erro registrado ainda.
`,
  learningProgress: `# Progresso de Aprendizado

Nenhum progresso registrado ainda.
`
};

export function ensureStorageFiles(): void {
  ensureDirectory(dirname(storagePaths.projectContext));

  if (
    existsSync(legacyProjectContextPath) &&
    !existsSync(storagePaths.projectContext)
  ) {
    copyFileSync(legacyProjectContextPath, storagePaths.projectContext);
  }

  for (const [key, filePath] of Object.entries(storagePaths)) {
    ensureFile(filePath, defaultStorageContents[key as StorageFileKey]);
  }
}

export function readStorageFile(key: StorageFileKey): string {
  ensureStorageFiles();
  return readTextFile(storagePaths[key]);
}

export function writeStorageFile(
  key: StorageFileKey,
  content: string,
  options?: { backup?: boolean }
): void {
  ensureStorageFiles();
  writeTextFile(storagePaths[key], content, options);
}

export function readProjectContext(): string {
  return readStorageFile("projectContext");
}

export function updateProjectContextFile(markdown: string): void {
  const cleanMarkdown = stripMarkdownCodeFence(markdown);
  writeStorageFile("projectContext", cleanMarkdown, { backup: true });
}

export function getProjectContextSummary(maxLength = 900): string {
  return createMarkdownSummary(readProjectContext(), maxLength);
}

export function buildAiProjectContext(): string {
  ensureStorageFiles();

  const sections: Array<[string, StorageFileKey, number]> = [
    ["project-context.md", "projectContext", 6000],
    ["decisions.md", "decisions", 3500],
    ["tasks.md", "tasks", 3500],
    ["errors.md", "errors", 3500],
    ["learning-progress.md", "learningProgress", 2500]
  ];

  return sections
    .map(([filename, key, maxLength]) => {
      const content = truncateMarkdown(readStorageFile(key), maxLength);
      return `## ${filename}\n\n${content}`;
    })
    .join("\n\n---\n\n");
}
