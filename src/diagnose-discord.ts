import "dotenv/config";
import { Client, Events, GatewayIntentBits, REST } from "discord.js";

const token = process.env.DISCORD_TOKEN?.trim();
const clientId = process.env.DISCORD_CLIENT_ID?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();

if (!token || !clientId || !guildId) {
  throw new Error("Faltam DISCORD_TOKEN, DISCORD_CLIENT_ID ou DISCORD_GUILD_ID no .env");
}

const discordToken = token;

console.log("ENV CLIENT ID:", clientId);
console.log("ENV GUILD ID:", guildId);
console.log("TOKEN EXISTE?", Boolean(token));
console.log("TOKEN TAMANHO:", token.length);

async function checkApplication() {
  const rest = new REST({ version: "10" }).setToken(discordToken);

  const app = await rest.get("/oauth2/applications/@me" as `/${string}`) as {
    id: string;
    name: string;
    bot_public?: boolean;
  };

  console.log("\nAplicação detectada pelo TOKEN:");
  console.log("APP NAME:", app.name);
  console.log("APP ID:", app.id);
  console.log("BOT PUBLIC:", app.bot_public);

  if (app.id !== clientId) {
    console.log("\n❌ PROBLEMA ENCONTRADO:");
    console.log("O DISCORD_CLIENT_ID do .env NÃO pertence ao token do bot.");
    console.log(`No .env está: ${clientId}`);
    console.log(`Mas o token pertence ao app: ${app.id}`);
    console.log("\nCorrija o DISCORD_CLIENT_ID no .env.");
  } else {
    console.log("\n✅ TOKEN e DISCORD_CLIENT_ID pertencem à mesma aplicação.");
  }
}

async function checkGuilds() {
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
      console.log("❌ O bot não está em nenhum servidor.");
    }

    for (const guild of guilds) {
      console.log(`- ${guild.name} | ${guild.id}`);
    }

    const foundGuild = guilds.find((guild) => guild.id === guildId);

    if (!foundGuild) {
      console.log("\n❌ PROBLEMA ENCONTRADO:");
      console.log("O DISCORD_GUILD_ID do .env não é um servidor onde o bot está.");
      console.log(`No .env está: ${guildId}`);
      console.log("\nUse um dos IDs listados acima como DISCORD_GUILD_ID.");
    } else {
      console.log("\n✅ O bot está no servidor configurado no DISCORD_GUILD_ID.");
    }

    client.destroy();
  });

  await client.login(discordToken);
}

async function main() {
  await checkApplication();
  await checkGuilds();
}

main().catch((error) => {
  console.error("\nErro no diagnóstico:", error);
});
