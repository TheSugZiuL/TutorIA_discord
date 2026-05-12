import { SlashCommandBuilder } from "discord.js";
import { askTutor } from "../services/openai.service.js";
import { enforceAiCooldown } from "../services/permissions.service.js";
import { buildAiProjectContext } from "../services/context.service.js";
import type { BotCommand } from "../types/index.js";
import { INPUT_LIMITS } from "../types/index.js";
import { replyLongText } from "../utils/discord-message.util.js";

export const tutorCommand: BotCommand = {
  name: "tutor",
  data: new SlashCommandBuilder()
    .setName("tutor")
    .setDescription("Peça ajuda ao Tutor de Programação")
    .addStringOption((option) =>
      option
        .setName("pergunta")
        .setDescription("Digite sua dúvida de programação")
        .setRequired(true)
        .setMaxLength(INPUT_LIMITS.prompt)
    ),

  async execute(interaction) {
    if (!(await enforceAiCooldown(interaction))) {
      return;
    }

    const question = interaction.options.getString("pergunta", true);

    await interaction.deferReply();

    const answer = await askTutor(question, buildAiProjectContext());
    await replyLongText(interaction, answer, {
      filename: "resposta-tutor.md"
    });
  }
};
