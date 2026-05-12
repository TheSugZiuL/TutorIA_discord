import { SlashCommandBuilder } from "discord.js";
import {
  buildAiProjectContext,
  getProjectContextSummary,
  readProjectContext,
  updateProjectContextFile
} from "../services/context.service.js";
import {
  suggestContextIdeas,
  updateProjectContextWithAI
} from "../services/openai.service.js";
import {
  enforceAiCooldown,
  requireWritePermission
} from "../services/permissions.service.js";
import type { BotCommand } from "../types/index.js";
import { INPUT_LIMITS } from "../types/index.js";
import {
  replyLongText,
  replyWithMarkdownFile
} from "../utils/discord-message.util.js";

export const contextoCommand: BotCommand = {
  name: "contexto",
  data: new SlashCommandBuilder()
    .setName("contexto")
    .setDescription("Gerencia o contexto Markdown do projeto")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ver")
        .setDescription("Envia o contexto atual do projeto")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("atualizar")
        .setDescription("Pede para a IA atualizar o contexto do projeto")
        .addStringOption((option) =>
          option
            .setName("instrucao")
            .setDescription("Ex: estamos pensando em criar um jogo 2D em Java")
            .setRequired(true)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sugerir")
        .setDescription("Sugere projetos com base no contexto atual")
        .addStringOption((option) =>
          option
            .setName("area")
            .setDescription("Ex: jogos, IA, backend, web, bot, automação")
            .setRequired(false)
            .setMaxLength(INPUT_LIMITS.shortText)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "ver") {
      const context = readProjectContext();
      const summary = getProjectContextSummary();

      await replyWithMarkdownFile(
        interaction,
        context,
        "project-context.md",
        `Resumo curto do contexto:\n\n${summary}\n\nArquivo completo em Markdown:`,
        { ephemeral: true }
      );
      return;
    }

    if (subcommand === "atualizar") {
      if (!(await requireWritePermission(interaction))) {
        return;
      }

      if (!(await enforceAiCooldown(interaction))) {
        return;
      }

      const instruction = interaction.options.getString("instrucao", true);

      await interaction.deferReply();

      const updatedContext = await updateProjectContextWithAI(
        readProjectContext(),
        instruction
      );

      updateProjectContextFile(updatedContext);

      await replyLongText(
        interaction,
        "Contexto atualizado com sucesso. Use `/contexto ver` para revisar o Markdown salvo."
      );
      return;
    }

    if (subcommand === "sugerir") {
      if (!(await enforceAiCooldown(interaction))) {
        return;
      }

      const area = interaction.options.getString("area");

      await interaction.deferReply();

      const suggestions = await suggestContextIdeas(buildAiProjectContext(), area);
      await replyLongText(interaction, suggestions, {
        filename: "sugestoes-contexto.md"
      });
    }
  }
};
