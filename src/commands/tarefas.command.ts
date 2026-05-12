import { SlashCommandBuilder } from "discord.js";
import { buildAiProjectContext, readStorageFile } from "../services/context.service.js";
import { generateTasksFromObjective } from "../services/openai.service.js";
import {
  enforceAiCooldown,
  requireWritePermission
} from "../services/permissions.service.js";
import {
  addManualTask,
  completeTask,
  getNextTaskId,
  saveGeneratedTasks
} from "../services/tasks.service.js";
import type { BotCommand } from "../types/index.js";
import { INPUT_LIMITS } from "../types/index.js";
import {
  replyLongText,
  replyWithMarkdownFile
} from "../utils/discord-message.util.js";

export const tarefasCommand: BotCommand = {
  name: "tarefas",
  data: new SlashCommandBuilder()
    .setName("tarefas")
    .setDescription("Gera e gerencia tarefas do projeto")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("gerar")
        .setDescription("Gera tarefas pequenas a partir de um objetivo")
        .addStringOption((option) =>
          option
            .setName("objetivo")
            .setDescription("Objetivo que será quebrado em tarefas")
            .setRequired(true)
            .setMaxLength(INPUT_LIMITS.prompt)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("ver").setDescription("Mostra a lista de tarefas")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("adicionar")
        .setDescription("Adiciona uma tarefa manualmente")
        .addStringOption((option) =>
          option
            .setName("tarefa")
            .setDescription("Título da tarefa")
            .setRequired(true)
            .setMaxLength(INPUT_LIMITS.shortText)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("concluir")
        .setDescription("Marca uma tarefa como concluída")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID da tarefa, como T001")
            .setRequired(true)
            .setMaxLength(20)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "gerar") {
      if (!(await requireWritePermission(interaction))) {
        return;
      }

      if (!(await enforceAiCooldown(interaction))) {
        return;
      }

      const objective = interaction.options.getString("objetivo", true);

      await interaction.deferReply();

      const generatedTasks = await generateTasksFromObjective({
        organizedProjectContext: buildAiProjectContext(),
        objective,
        firstTaskId: getNextTaskId()
      });
      const savedTasks = saveGeneratedTasks(generatedTasks);

      await replyLongText(
        interaction,
        `Tarefas geradas e salvas em tasks.md:\n\n${savedTasks}`,
        { filename: "tarefas-geradas.md" }
      );
      return;
    }

    if (subcommand === "ver") {
      const tasks = readStorageFile("tasks");

      await replyWithMarkdownFile(
        interaction,
        tasks,
        "tasks.md",
        "Lista de tarefas do projeto:",
        { ephemeral: true }
      );
      return;
    }

    if (subcommand === "adicionar") {
      if (!(await requireWritePermission(interaction))) {
        return;
      }

      const task = interaction.options.getString("tarefa", true);
      const { id, entry } = addManualTask(task);

      await replyLongText(
        interaction,
        `Tarefa ${id} adicionada em tasks.md:\n\n${entry}`,
        { ephemeral: true }
      );
      return;
    }

    if (subcommand === "concluir") {
      if (!(await requireWritePermission(interaction))) {
        return;
      }

      const taskId = interaction.options.getString("id", true);
      const updatedTask = completeTask(taskId);

      await replyLongText(
        interaction,
        `Tarefa concluída e progresso registrado em learning-progress.md:\n\n${updatedTask}`,
        { ephemeral: true }
      );
    }
  }
};
