import { Client, Events, GatewayIntentBits } from "discord.js";
import { getDiscordEnv, getOpenAIEnv } from "./config/env.js";
import { commandMap } from "./commands/index.js";
import { ensureStorageFiles } from "./services/context.service.js";
import { replyLongText } from "./utils/discord-message.util.js";

const discordEnv = getDiscordEnv();
getOpenAIEnv();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
  ensureStorageFiles();
  console.log(`Bot online como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commandMap.get(interaction.commandName);

  if (!command) {
    await replyLongText(interaction, "Comando não encontrado.", {
      ephemeral: true
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Erro ao executar /${interaction.commandName}:`, error);

    try {
      await replyLongText(
        interaction,
        "Não consegui concluir esse comando. Verifique o terminal para mais detalhes.",
        { ephemeral: true }
      );
    } catch (replyError) {
      console.error("Erro ao responder falha do comando:", replyError);
    }
  }
});

client.login(discordEnv.token).catch((error) => {
  console.error("Erro ao conectar no Discord:", error);
  process.exitCode = 1;
});
