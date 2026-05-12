import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN?.trim();
const clientId = process.env.DISCORD_CLIENT_ID?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();

if (!token || !clientId || !guildId) {
  throw new Error(
    "Faltam variáveis no .env: DISCORD_TOKEN, DISCORD_CLIENT_ID ou DISCORD_GUILD_ID"
  );
}

const discordClientId = clientId;
const discordGuildId = guildId;

const commands = [
  new SlashCommandBuilder()
    .setName("tutor")
    .setDescription("Peça ajuda ao Tutor de Programação")
    .addStringOption((option) =>
      option
        .setName("pergunta")
        .setDescription("Digite sua dúvida de programação")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("contexto")
    .setDescription("Gerencia o contexto markdown do projeto")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ver")
        .setDescription("Mostra o contexto atual do projeto")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("atualizar")
        .setDescription("Pede para a IA atualizar o contexto do projeto")
        .addStringOption((option) =>
          option
            .setName("instrucao")
            .setDescription("Ex: estamos pensando em criar um app de tarefas com IA")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sugerir")
        .setDescription("Pede sugestões de projeto com base no contexto atual")
        .addStringOption((option) =>
          option
            .setName("area")
            .setDescription("Ex: IA, backend, web, bot, automação")
            .setRequired(false)
        )
    )
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
  console.log("Registrando comandos...");

  await rest.put(Routes.applicationGuildCommands(discordClientId, discordGuildId), {
    body: commands
  });

  console.log("Comandos registrados com sucesso.");
}

main().catch((error) => {
  console.error("Erro ao registrar comandos:", error);
});
