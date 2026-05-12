import { SlashCommandBuilder } from "discord.js";
import { buildAiProjectContext } from "../services/context.service.js";
import { saveErrorEntry } from "../services/errors.service.js";
import { analyzeError } from "../services/openai.service.js";
import {
  enforceAiCooldown,
  requireWritePermission
} from "../services/permissions.service.js";
import type { BotCommand } from "../types/index.js";
import { INPUT_LIMITS } from "../types/index.js";
import { replyLongText } from "../utils/discord-message.util.js";

export const erroCommand: BotCommand = {
  name: "erro",
  data: new SlashCommandBuilder()
    .setName("erro")
    .setDescription("Analisa e registra erros encontrados no projeto")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("analisar")
        .setDescription("Analisa uma mensagem de erro")
        .addStringOption((option) =>
          option
            .setName("mensagem")
            .setDescription("Mensagem de erro")
            .setRequired(true)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
        .addStringOption((option) =>
          option
            .setName("contexto")
            .setDescription("Contexto opcional: stack, arquivo ou o que você tentou")
            .setRequired(false)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("salvar")
        .setDescription("Salva uma solução de erro em errors.md")
        .addStringOption((option) =>
          option
            .setName("titulo")
            .setDescription("Título curto do erro")
            .setRequired(true)
            .setMaxLength(INPUT_LIMITS.shortText)
        )
        .addStringOption((option) =>
          option
            .setName("solucao")
            .setDescription("Solução aplicada")
            .setRequired(true)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
        .addStringOption((option) =>
          option
            .setName("erro")
            .setDescription("Mensagem original do erro")
            .setRequired(false)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
        .addStringOption((option) =>
          option
            .setName("observacoes")
            .setDescription("Observações opcionais")
            .setRequired(false)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "analisar") {
      if (!(await enforceAiCooldown(interaction))) {
        return;
      }

      const message = interaction.options.getString("mensagem", true);
      const extraContext = interaction.options.getString("contexto");

      await interaction.deferReply();

      const analysis = await analyzeError({
        organizedProjectContext: buildAiProjectContext(),
        message,
        extraContext
      });

      await replyLongText(interaction, analysis, {
        filename: "analise-de-erro.md"
      });
      return;
    }

    if (subcommand === "salvar") {
      if (!(await requireWritePermission(interaction))) {
        return;
      }

      const title = interaction.options.getString("titulo", true);
      const solution = interaction.options.getString("solucao", true);
      const errorMessage = interaction.options.getString("erro");
      const observations = interaction.options.getString("observacoes");
      const entry = saveErrorEntry({
        title,
        errorMessage,
        solution,
        observations
      });

      await replyLongText(interaction, `Erro salvo em errors.md:\n\n${entry}`, {
        ephemeral: true
      });
    }
  }
};
