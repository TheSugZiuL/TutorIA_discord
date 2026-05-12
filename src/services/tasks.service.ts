import { readStorageFile, writeStorageFile } from "./context.service.js";
import { escapeRegExp, removePlaceholder, stripMarkdownCodeFence } from "../utils/markdown.util.js";

const tasksPlaceholder = "Nenhuma tarefa registrada ainda.";
const progressPlaceholder = "Nenhum progresso registrado ainda.";

export function getNextTaskId(): string {
  const content = readStorageFile("tasks");
  const ids = [...content.matchAll(/^##\s+T(\d+)\s+-/gim)].map((match) =>
    Number(match[1])
  );
  const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

  return `T${String(nextId).padStart(3, "0")}`;
}

export function saveGeneratedTasks(markdown: string): string {
  const cleanMarkdown = stripMarkdownCodeFence(markdown);
  const currentContent = removePlaceholder(readStorageFile("tasks"), tasksPlaceholder)
    .trimEnd();

  writeStorageFile("tasks", `${currentContent}\n\n${cleanMarkdown}`, {
    backup: true
  });

  return cleanMarkdown;
}

export function addManualTask(taskTitle: string): { id: string; entry: string } {
  const id = getNextTaskId();
  const currentContent = removePlaceholder(readStorageFile("tasks"), tasksPlaceholder)
    .trimEnd();
  const entry = `## ${id} - ${taskTitle.trim()}
- Descrição: Tarefa adicionada manualmente.
- Prioridade: média
- Dificuldade: 1
- Status: pendente
- Ordem sugerida: revisar manualmente
`;

  writeStorageFile("tasks", `${currentContent}\n\n${entry}`, { backup: true });

  return { id, entry };
}

export function completeTask(taskId: string): string {
  const normalizedId = taskId.trim().toUpperCase();
  const content = readStorageFile("tasks");
  const taskRegex = new RegExp(
    `(^##\\s+${escapeRegExp(normalizedId)}\\b[\\s\\S]*?)(?=\\n##\\s+T\\d+\\b|$)`,
    "im"
  );
  const match = content.match(taskRegex);

  if (!match || match.index === undefined) {
    throw new Error(`Tarefa ${normalizedId} não encontrada.`);
  }

  const currentBlock = match[1] ?? "";
  const updatedBlock = currentBlock.match(/- Status:/i)
    ? currentBlock.replace(/- Status:\s*.*$/im, "- Status: concluída")
    : `${currentBlock.trimEnd()}\n- Status: concluída\n`;
  const updatedContent =
    content.slice(0, match.index) +
    updatedBlock +
    content.slice(match.index + currentBlock.length);

  writeStorageFile("tasks", updatedContent, { backup: true });
  appendLearningProgress(normalizedId, extractTaskTitle(currentBlock));

  return updatedBlock;
}

function appendLearningProgress(taskId: string, taskTitle: string): void {
  const currentContent = removePlaceholder(
    readStorageFile("learningProgress"),
    progressPlaceholder
  ).trimEnd();
  const date = new Date().toISOString();
  const entry = `## ${date} - ${taskId} concluída

Tarefa concluída: ${taskTitle || taskId}
`;

  writeStorageFile("learningProgress", `${currentContent}\n\n${entry}`, {
    backup: true
  });
}

function extractTaskTitle(taskBlock: string): string {
  const match = taskBlock.match(/^##\s+T\d+\s+-\s+(.+)$/im);
  return match?.[1]?.trim() ?? "";
}
