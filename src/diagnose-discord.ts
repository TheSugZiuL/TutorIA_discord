import { Client, Events, GatewayIntentBits, REST } from "discord.js";
import { getDiscordEnv } from "./config/env.js";

const { token, clientId, guildId } = getDiscordEnv();

console.log("ENV CLIENT ID:", clientId);
console.log("ENV GUILD ID:", guildId);
console.log("TOKEN EXISTE?", Boolean(token));
console.log("TOKEN TAMANHO:", token.length);

async function checkApplication(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);

  const app = (await rest.get("/oauth2/applications/@me" as `/${string}`)) as {
    id: string;
    name: string;
    bot_public?: boolean;
  };

  console.log("\nAplicação detectada pelo TOKEN:");
  console.log("APP NAME:", app.name);
  console.log("APP ID:", app.id);
  console.log("BOT PUBLIC:", app.bot_public);

  if (app.id !== clientId) {
    console.log("\nPROBLEMA ENCONTRADO:");
    console.log("O DISCORD_CLIENT_ID do .env não pertence ao token do bot.");
    console.log(`No .env está: ${clientId}`);
    console.log(`Mas o token pertence ao app: ${app.id}`);
    console.log("\nCorrija o DISCORD_CLIENT_ID no .env.");
    return;
  }

  console.log("\nTOKEN e DISCORD_CLIENT_ID pertencem à mesma aplicação.");
}

async function checkGuilds(): Promise<void> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`\nBot logado como: ${readyClient.user.tag}`);
    console.log("Servidores onde o bot está:");

    const guilds = readyClient.guilds.cache.map((guild) => ({
      name: guild.name,
      id: guild.id
    }));

    if (guilds.length === 0) {
      console.log("O bot não está em nenhum servidor.");
    }

    for (const guild of guilds) {
      console.log(`- ${guild.name} | ${guild.id}`);
    }

    const foundGuild = guilds.find((guild) => guild.id === guildId);

    if (!foundGuild) {
      console.log("\nPROBLEMA ENCONTRADO:");
      console.log("O DISCORD_GUILD_ID do .env não é um servidor onde o bot está.");
      console.log(`No .env está: ${guildId}`);
      console.log("\nUse um dos IDs listados acima como DISCORD_GUILD_ID.");
    } else {
      console.log("\nO bot está no servidor configurado no DISCORD_GUILD_ID.");
    }

    client.destroy();
  });

  await client.login(token);
}

async function main(): Promise<void> {
  await checkApplication();
  await checkGuilds();
}

main().catch((error) => {
  console.error("\nErro no diagnóstico:", error);
  process.exitCode = 1;
});
