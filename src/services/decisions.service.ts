import { readStorageFile, writeStorageFile } from "./context.service.js";
import { removePlaceholder } from "../utils/markdown.util.js";

const decisionsPlaceholder = "Nenhuma decisão registrada ainda.";

export function saveDecision(decision: string, reason?: string | null): string {
  const currentContent = removePlaceholder(
    readStorageFile("decisions"),
    decisionsPlaceholder
  ).trimEnd();
  const date = new Date().toISOString();
  const entry = `## ${date} - Decisão registrada

**Decisão:** ${decision}

**Motivo:** ${reason?.trim() || "Não informado."}
`;

  writeStorageFile("decisions", `${currentContent}\n\n${entry}`, {
    backup: true
  });

  return entry;
}
