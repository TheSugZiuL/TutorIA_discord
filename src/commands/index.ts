import type { BotCommand } from "../types/index.js";
import { commitCommand } from "./commit.command.js";
import { contextoCommand } from "./contexto.command.js";
import { decidirCommand } from "./decidir.command.js";
import { erroCommand } from "./erro.command.js";
import { ideiasCommand } from "./ideias.command.js";
import { revisarCommand } from "./revisar.command.js";
import { tarefasCommand } from "./tarefas.command.js";
import { tutorCommand } from "./tutor.command.js";

export const commands: BotCommand[] = [
  tutorCommand,
  contextoCommand,
  ideiasCommand,
  decidirCommand,
  tarefasCommand,
  erroCommand,
  revisarCommand,
  commitCommand
];

export const commandMap = new Map(
  commands.map((command) => [command.name, command])
);
