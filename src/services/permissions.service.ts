import type { ChatInputCommandInteraction } from "discord.js";
import { getAuthorizedUserIds } from "../config/env.js";
import { replyLongText } from "../utils/discord-message.util.js";

const AI_COOLDOWN_MS = 8000;
const aiCooldownsByUser = new Map<string, number>();

export function canUserWriteFiles(userId: string): boolean {
  const authorizedUserIds = getAuthorizedUserIds();

  if (authorizedUserIds.size === 0) {
    return true;
  }

  return authorizedUserIds.has(userId);
}

export async function requireWritePermission(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  if (canUserWriteFiles(interaction.user.id)) {
    return true;
  }

  await replyLongText(
    interaction,
    "Você não tem permissão para usar comandos que alteram arquivos do projeto.",
    { ephemeral: true }
  );

  return false;
}

export async function enforceAiCooldown(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  const now = Date.now();
  const lastUsage = aiCooldownsByUser.get(interaction.user.id) ?? 0;
  const remainingMs = AI_COOLDOWN_MS - (now - lastUsage);

  if (remainingMs > 0) {
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    await replyLongText(
      interaction,
      `Aguarde ${remainingSeconds}s antes de usar outro comando com IA.`,
      { ephemeral: true }
    );

    return false;
  }

  aiCooldownsByUser.set(interaction.user.id, now);
  return true;
}
