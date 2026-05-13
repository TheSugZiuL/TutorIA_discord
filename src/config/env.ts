import "dotenv/config";

export interface DiscordEnv {
  token: string;
  clientId: string;
  guildId: string;
}

export interface OpenAIEnv {
  apiKey: string;
  model: string;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Falta ${name} no .env`);
  }

  return value;
}

export function getDiscordEnv(): DiscordEnv {
  return {
    token: readRequiredEnv("DISCORD_TOKEN"),
    clientId: readRequiredEnv("DISCORD_CLIENT_ID"),
    guildId: readRequiredEnv("DISCORD_GUILD_ID")
  };
}

export function getOpenAIEnv(): OpenAIEnv {
  return {
    apiKey: readRequiredEnv("OPENAI_API_KEY"),
    model: readRequiredEnv("OPENAI_MODEL")
  };
}

export function getAuthorizedUserIds(): Set<string> {
  const rawValue = process.env.AUTHORIZED_USER_IDS?.trim();

  if (!rawValue) {
    return new Set();
  }

  const ids = rawValue
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return new Set(ids);
}

export function getSqliteDatabasePath(): string {
  return process.env.SQLITE_DATABASE_PATH?.trim() || "data/tutor-dev-bot.sqlite";
}
