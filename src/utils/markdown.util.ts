export function stripMarkdownCodeFence(markdown: string): string {
  const trimmed = markdown.trim();
  const fenceMatch = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);

  if (!fenceMatch) {
    return trimmed;
  }

  return fenceMatch[1]?.trim() ?? trimmed;
}

export function truncateMarkdown(markdown: string, maxLength: number): string {
  const trimmed = markdown.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}\n\n> Conteúdo resumido por limite de tamanho.`;
}

export function createMarkdownSummary(markdown: string, maxLength = 800): string {
  const meaningfulLines = markdown
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(0, 24)
    .join("\n");

  return truncateMarkdown(meaningfulLines || "Sem conteúdo registrado.", maxLength);
}

export function removePlaceholder(markdown: string, placeholder: string): string {
  return markdown.replace(new RegExp(`\\n*${escapeRegExp(placeholder)}\\s*$`, "u"), "");
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
