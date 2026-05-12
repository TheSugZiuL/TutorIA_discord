import { SlashCommandBuilder } from "discord.js";
import { buildAiProjectContext } from "../services/context.service.js";
import { reviewCode } from "../services/openai.service.js";
import { enforceAiCooldown } from "../services/permissions.service.js";
import type { BotCommand } from "../types/index.js";
import { INPUT_LIMITS } from "../types/index.js";
import { replyLongText } from "../utils/discord-message.util.js";

export const revisarCommand: BotCommand = {
  name: "revisar",
  data: new SlashCommandBuilder()
    .setName("revisar")
    .setDescription("Revisa um trecho de código colado no Discord")
    .addStringOption((option) =>
      option
        .setName("codigo")
        .setDescription("Código para revisar")
        .setRequired(true)
        .setMaxLength(INPUT_LIMITS.code)
    )
    .addStringOption((option) =>
      option
        .setName("linguagem")
        .setDescription("Linguagem do código")
        .setRequired(false)
        .setMaxLength(80)
    )
    .addStringOption((option) =>
      option
        .setName("objetivo")
        .setDescription("O que o código deveria fazer")
        .setRequired(false)
        .setMaxLength(INPUT_LIMITS.shortText)
    ),

  async execute(interaction) {
    if (!(await enforceAiCooldown(interaction))) {
      return;
    }

    const code = interaction.options.getString("codigo", true);

    if (code.length > INPUT_LIMITS.code) {
      await replyLongText(
        interaction,
        "Esse código ficou grande demais para revisar bem pelo Discord. Envie um trecho menor, de preferência a função ou arquivo onde está a dúvida.",
        { ephemeral: true }
      );
      return;
    }

    const language = interaction.options.getString("linguagem");
    const objective = interaction.options.getString("objetivo");

    await interaction.deferReply();

    const review = await reviewCode({
      organizedProjectContext: buildAiProjectContext(),
      code,
      language,
      objective
    });

    await replyLongText(interaction, review, {
      filename: "revisao-de-codigo.md"
    });
  }
};
