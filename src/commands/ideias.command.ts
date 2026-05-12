import { SlashCommandBuilder } from "discord.js";
import { buildAiProjectContext } from "../services/context.service.js";
import { generateProjectIdeas } from "../services/openai.service.js";
import { enforceAiCooldown } from "../services/permissions.service.js";
import type { BotCommand } from "../types/index.js";
import { INPUT_LIMITS } from "../types/index.js";
import { replyLongText } from "../utils/discord-message.util.js";

export const ideiasCommand: BotCommand = {
  name: "ideias",
  data: new SlashCommandBuilder()
    .setName("ideias")
    .setDescription("Gera ideias realistas de projetos para dois amigos")
    .addStringOption((option) =>
      option
        .setName("area")
        .setDescription("Área de interesse, como jogos, backend, IA ou web")
        .setRequired(false)
        .setMaxLength(INPUT_LIMITS.shortText)
    )
    .addStringOption((option) =>
      option
        .setName("objetivo")
        .setDescription("Objetivo de aprendizado ou portfólio")
        .setRequired(false)
        .setMaxLength(INPUT_LIMITS.shortText)
    ),

  async execute(interaction) {
    if (!(await enforceAiCooldown(interaction))) {
      return;
    }

    const area = interaction.options.getString("area");
    const objetivo = interaction.options.getString("objetivo");

    await interaction.deferReply();

    const ideas = await generateProjectIdeas({
      organizedProjectContext: buildAiProjectContext(),
      area,
      objetivo
    });

    await replyLongText(interaction, ideas, {
      filename: "ideias-de-projeto.md"
    });
  }
};
