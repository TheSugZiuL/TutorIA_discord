import { REST, Routes } from "discord.js";
import { getDiscordEnv } from "./config/env.js";
import { commands } from "./commands/index.js";

const { token, clientId, guildId } = getDiscordEnv();

const rest = new REST({ version: "10" }).setToken(token);

async function main(): Promise<void> {
  const body = commands.map((command) => command.data.toJSON());

  console.log(`Registrando ${body.length} comandos...`);

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body
  });

  console.log("Comandos registrados com sucesso.");
}

main().catch((error) => {
  console.error("Erro ao registrar comandos:", error);
  process.exitCode = 1;
});
