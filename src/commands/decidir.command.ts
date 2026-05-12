import { SlashCommandBuilder } from "discord.js";
import { buildAiProjectContext } from "../services/context.service.js";
import { saveDecision } from "../services/decisions.service.js";
import { compareIdeas } from "../services/openai.service.js";
import {
  enforceAiCooldown,
  requireWritePermission
} from "../services/permissions.service.js";
import type { BotCommand } from "../types/index.js";
import { INPUT_LIMITS } from "../types/index.js";
import { replyLongText } from "../utils/discord-message.util.js";

export const decidirCommand: BotCommand = {
  name: "decidir",
  data: new SlashCommandBuilder()
    .setName("decidir")
    .setDescription("Compara ideias e registra decisões do projeto")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("comparar")
        .setDescription("Compara duas ideias e recomenda um caminho")
        .addStringOption((option) =>
          option
            .setName("ideia_a")
            .setDescription("Primeira ideia")
            .setRequired(true)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
        .addStringOption((option) =>
          option
            .setName("ideia_b")
            .setDescription("Segunda ideia")
            .setRequired(true)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
        .addStringOption((option) =>
          option
            .setName("criterio")
            .setDescription("Critério extra, como aprendizado, prazo ou portfólio")
            .setRequired(false)
            .setMaxLength(INPUT_LIMITS.shortText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("salvar")
        .setDescription("Salva uma decisão confirmada em decisions.md")
        .addStringOption((option) =>
          option
            .setName("decisao")
            .setDescription("Decisão tomada")
            .setRequired(true)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
        .addStringOption((option) =>
          option
            .setName("motivo")
            .setDescription("Motivo da decisão")
            .setRequired(false)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "comparar") {
      if (!(await enforceAiCooldown(interaction))) {
        return;
      }

      const ideiaA = interaction.options.getString("ideia_a", true);
      const ideiaB = interaction.options.getString("ideia_b", true);
      const criterio = interaction.options.getString("criterio");

      await interaction.deferReply();

      const comparison = await compareIdeas({
        organizedProjectContext: buildAiProjectContext(),
        ideiaA,
        ideiaB,
        criterio
      });

      await replyLongText(interaction, comparison, {
        filename: "comparacao-de-ideias.md"
      });
      return;
    }

    if (subcommand === "salvar") {
      if (!(await requireWritePermission(interaction))) {
        return;
      }

      const decisao = interaction.options.getString("decisao", true);
      const motivo = interaction.options.getString("motivo");
      const entry = saveDecision(decisao, motivo);

      await replyLongText(
        interaction,
        `Decisão salva em decisions.md:\n\n${entry}`,
        { ephemeral: true }
      );
    }
  }
};
