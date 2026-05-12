import { SlashCommandBuilder } from "discord.js";
import { generateCommitMessage } from "../services/openai.service.js";
import { enforceAiCooldown } from "../services/permissions.service.js";
import type { BotCommand } from "../types/index.js";
import { INPUT_LIMITS } from "../types/index.js";
import { replyLongText } from "../utils/discord-message.util.js";

export const commitCommand: BotCommand = {
  name: "commit",
  data: new SlashCommandBuilder()
    .setName("commit")
    .setDescription("Gera uma mensagem de commit no padrão Conventional Commits")
    .addStringOption((option) =>
      option
        .setName("alteracoes")
        .setDescription("Resumo das alterações feitas")
        .setRequired(true)
        .setMaxLength(INPUT_LIMITS.prompt)
    )
    .addStringOption((option) =>
      option
        .setName("idioma")
        .setDescription("Use pt para commit em português; vazio gera em inglês")
        .setRequired(false)
        .setMaxLength(20)
    ),

  async execute(interaction) {
    if (!(await enforceAiCooldown(interaction))) {
      return;
    }

    const changes = interaction.options.getString("alteracoes", true);
    const idioma = interaction.options.getString("idioma");

    await interaction.deferReply();

    const commitMessage = await generateCommitMessage({ changes, idioma });
    await replyLongText(interaction, commitMessage);
  }
};
