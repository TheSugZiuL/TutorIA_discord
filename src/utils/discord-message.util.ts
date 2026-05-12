import { AttachmentBuilder, type ChatInputCommandInteraction } from "discord.js";

const DISCORD_MESSAGE_LIMIT = 2000;
const DEFAULT_SAFE_LIMIT = 1800;
const FILE_FALLBACK_THRESHOLD = 12000;

export function sanitizeDiscordText(text: string): string {
  return text
    .replace(/@everyone/gi, "@\u200beveryone")
    .replace(/@here/gi, "@\u200bhere");
}

export function splitDiscordMessage(
  text: string,
  maxLength = DEFAULT_SAFE_LIMIT
): string[] {
  const safeMaxLength = Math.min(maxLength, DEFAULT_SAFE_LIMIT);
  const normalizedText = sanitizeDiscordText(text).trim();

  if (!normalizedText) {
    return ["Sem conteúdo para exibir."];
  }

  if (normalizedText.length <= safeMaxLength) {
    return [normalizedText];
  }

  const chunks: string[] = [];
  const paragraphs = normalizedText.split(/\n{2,}/);
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const nextChunk = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (nextChunk.length <= safeMaxLength) {
      currentChunk = nextChunk;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    if (paragraph.length <= safeMaxLength) {
      currentChunk = paragraph;
      continue;
    }

    const lines = paragraph.split(/\r?\n/);

    for (const line of lines) {
      const nextLineChunk = currentChunk ? `${currentChunk}\n${line}` : line;

      if (nextLineChunk.length <= safeMaxLength) {
        currentChunk = nextLineChunk;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      if (line.length <= safeMaxLength) {
        currentChunk = line;
        continue;
      }

      for (let index = 0; index < line.length; index += safeMaxLength) {
        chunks.push(line.slice(index, index + safeMaxLength));
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export async function replyLongText(
  interaction: ChatInputCommandInteraction,
  text: string,
  options?: {
    ephemeral?: boolean;
    maxLength?: number;
    fileFallback?: boolean;
    filename?: string;
    message?: string;
  }
): Promise<void> {
  const sanitizedText = sanitizeDiscordText(text);

  if (
    options?.fileFallback !== false &&
    sanitizedText.length > FILE_FALLBACK_THRESHOLD
  ) {
    const fileOptions =
      options?.ephemeral === undefined
        ? undefined
        : { ephemeral: options.ephemeral };

    await replyWithMarkdownFile(
      interaction,
      sanitizedText,
      options?.filename ?? "resposta.md",
      options?.message ?? "A resposta ficou grande, então enviei em Markdown:",
      fileOptions
    );
    return;
  }

  const chunks = splitDiscordMessage(sanitizedText, options?.maxLength);
  const totalChunks = chunks.length;

  const formatChunk = (chunk: string, index: number): string => {
    if (totalChunks === 1) {
      return chunk;
    }

    return `**Parte ${index + 1}/${totalChunks}**\n\n${chunk}`;
  };

  const [firstChunk = "", ...remainingChunks] = chunks;
  const firstContent = fitDiscordLimit(formatChunk(firstChunk, 0));

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: firstContent,
      allowedMentions: { parse: [] }
    });
  } else {
    await interaction.reply({
      content: firstContent,
      ephemeral: options?.ephemeral ?? false,
      allowedMentions: { parse: [] }
    });
  }

  for (const [offset, chunk] of remainingChunks.entries()) {
    await interaction.followUp({
      content: fitDiscordLimit(formatChunk(chunk, offset + 1)),
      ephemeral: options?.ephemeral ?? false,
      allowedMentions: { parse: [] }
    });
  }
}

export async function replyWithMarkdownFile(
  interaction: ChatInputCommandInteraction,
  markdown: string,
  filename: string,
  message: string,
  options?: {
    ephemeral?: boolean;
  }
): Promise<void> {
  const attachment = new AttachmentBuilder(Buffer.from(markdown, "utf-8"), {
    name: filename
  });
  const content = fitDiscordLimit(sanitizeDiscordText(message), 1900);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content,
      files: [attachment],
      allowedMentions: { parse: [] }
    });
    return;
  }

  await interaction.reply({
    content,
    files: [attachment],
    ephemeral: options?.ephemeral ?? false,
    allowedMentions: { parse: [] }
  });
}

function fitDiscordLimit(
  text: string,
  maxLength = DISCORD_MESSAGE_LIMIT
): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 20).trimEnd() + "\n...(continua)";
}
