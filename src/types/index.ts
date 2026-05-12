import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder
} from "discord.js";

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface BotCommand {
  name: string;
  data: SlashCommandData;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export type StorageFileKey =
  | "projectContext"
  | "decisions"
  | "tasks"
  | "errors"
  | "learningProgress";

export const INPUT_LIMITS = {
  shortText: 1000,
  prompt: 3000,
  code: 6000
} as const;
