import { readStorageFile, writeStorageFile } from "./context.service.js";
import { removePlaceholder } from "../utils/markdown.util.js";

const errorsPlaceholder = "Nenhum erro registrado ainda.";

export function saveErrorEntry(options: {
  title: string;
  errorMessage?: string | null;
  solution: string;
  observations?: string | null;
}): string {
  const currentContent = removePlaceholder(readStorageFile("errors"), errorsPlaceholder)
    .trimEnd();
  const date = new Date().toISOString();
const entry = `## ${date} - ${options.title.trim()}

- Erro: ${options.errorMessage?.trim() || "Não informado."}
- Solução: ${options.solution.trim()}
- Observações: ${options.observations?.trim() || "Nenhuma."}
`;

  writeStorageFile("errors", `${currentContent}\n\n${entry}`, { backup: true });

  return entry;
}
