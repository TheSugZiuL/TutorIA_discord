import "dotenv/config";
import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits
} from "discord.js";
import OpenAI from "openai";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { dirname } from "node:path";

const discordToken = process.env.DISCORD_TOKEN?.trim();
const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";

if (!discordToken) {
  throw new Error("Falta DISCORD_TOKEN no .env");
}

if (!openaiApiKey) {
  throw new Error("Falta OPENAI_API_KEY no .env");
}

const openai = new OpenAI({
  apiKey: openaiApiKey
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const CONTEXT_FILE_PATH = "src/project-context.md";
const BACKUP_FOLDER_PATH = "context-backups";

const defaultProjectContext = `# Contexto do Projeto

## Status atual

Ainda não decidimos o projeto.

## Objetivo do grupo

Aprender programação criando um projeto prático, útil e possível de desenvolver aos poucos.

## Ideias consideradas

Nenhuma ideia escolhida ainda.

## Ideia escolhida

Ainda não definida.

## Stack técnica provável

Ainda não definida.

## Regras do projeto

- Começar simples
- Priorizar MVP
- Evitar arquitetura complexa no início
- Aprender durante o desenvolvimento
- Dividir o projeto em tarefas pequenas
- Documentar decisões importantes

## Decisões tomadas

Nenhuma decisão final ainda.

## Dúvidas em aberto

- Qual problema real queremos resolver?
- O projeto será web, mobile, bot, automação ou IA?
- Quanto tempo temos para desenvolver?
- Qual stack vamos usar?

## Próximos passos

1. Levantar ideias possíveis.
2. Escolher uma ideia viável.
3. Definir MVP.
4. Definir stack.
5. Criar tarefas iniciais.
`;

const tutorInstructions = `
Você é um Tutor de Programação dentro de um servidor privado do Discord.

Objetivo:
Ajudar dois amigos a escolherem, planejarem e desenvolverem um projeto de programação real.

Comportamento:
- Responda em português do Brasil.
- Seja didático, simples e direto.
- Explique o raciocínio, não apenas a resposta.
- Ajude os usuários a tomarem boas decisões técnicas.
- Se o projeto ainda não estiver definido, ajude a comparar ideias.
- Quando houver erro de código, explique causa provável, correção, teste e prevenção.
- Quando o usuário pedir arquitetura, comece por uma solução simples.
- Evite overengineering.
- Use exemplos curtos de código quando fizer sentido.
- Se faltar contexto, peça o trecho de código, stack usada ou mensagem de erro.

Formato preferencial:
Diagnóstico:
Solução:
Exemplo:
Próximo passo:
`;

function ensureContextFileExists() {
  const folder = dirname(CONTEXT_FILE_PATH);

  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
  }

  if (!existsSync(CONTEXT_FILE_PATH)) {
    writeFileSync(CONTEXT_FILE_PATH, defaultProjectContext, "utf-8");
  }
}

function readProjectContext() {
  ensureContextFileExists();
  return readFileSync(CONTEXT_FILE_PATH, "utf-8");
}

function backupProjectContext(currentContext: string) {
  if (!existsSync(BACKUP_FOLDER_PATH)) {
    mkdirSync(BACKUP_FOLDER_PATH, { recursive: true });
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const backupPath = `${BACKUP_FOLDER_PATH}/project-context-${timestamp}.md`;

  writeFileSync(backupPath, currentContext, "utf-8");
}

function writeProjectContext(newContext: string) {
  const currentContext = readProjectContext();

  backupProjectContext(currentContext);

  writeFileSync(CONTEXT_FILE_PATH, newContext.trim() + "\n", "utf-8");
}

function splitDiscordMessage(text: string, maxLength = 1700): string[] {
  const normalizedText = text.trim();

  if (normalizedText.length <= maxLength) {
    return [normalizedText];
  }

  const chunks: string[] = [];
  const paragraphs = normalizedText.split(/\n{2,}/);

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const nextChunk = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (nextChunk.length <= maxLength) {
      currentChunk = nextChunk;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    if (paragraph.length <= maxLength) {
      currentChunk = paragraph;
      continue;
    }

    const lines = paragraph.split("\n");

    for (const line of lines) {
      const nextLineChunk = currentChunk
        ? `${currentChunk}\n${line}`
        : line;

      if (nextLineChunk.length <= maxLength) {
        currentChunk = nextLineChunk;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      if (line.length <= maxLength) {
        currentChunk = line;
        continue;
      }

      for (let i = 0; i < line.length; i += maxLength) {
        chunks.push(line.slice(i, i + maxLength));
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function replyLongText(
  interaction: ChatInputCommandInteraction,
  text: string,
  options?: {
    ephemeral?: boolean;
  }
) {
  const chunks = splitDiscordMessage(text);
  const totalChunks = chunks.length;

  const formatChunk = (chunk: string, index: number) => {
    if (totalChunks === 1) {
      return chunk;
    }

    return `**Parte ${index + 1}/${totalChunks}**\n\n${chunk}`;
  };

  const [firstChunk = "", ...remainingChunks] = chunks;
  const firstContent = formatChunk(firstChunk, 0);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: firstContent,
      allowedMentions: { parse: [] }
    });
  } else {
    await interaction.reply({
      content: firstContent,
      ephemeral: options?.ephemeral ?? false,
      allowedMentions: { parse: [] }
    });
  }

  for (const [offset, chunk] of remainingChunks.entries()) {
    const index = offset + 1;

    await interaction.followUp({
      content: formatChunk(chunk, index),
      ephemeral: options?.ephemeral ?? false,
      allowedMentions: { parse: [] }
    });
  }
}

async function replyWithMarkdownFile(
  interaction: ChatInputCommandInteraction,
  markdown: string,
  filename: string,
  message: string,
  options?: {
    ephemeral?: boolean;
  }
) {
  const attachment = new AttachmentBuilder(
    Buffer.from(markdown, "utf-8"),
    {
      name: filename
    }
  );

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: message,
      files: [attachment],
      allowedMentions: { parse: [] }
    });
  } else {
    await interaction.reply({
      content: message,
      files: [attachment],
      ephemeral: options?.ephemeral ?? false,
      allowedMentions: { parse: [] }
    });
  }
}

async function updateContextWithAI(userInstruction: string) {
  const currentContext = readProjectContext();

  const response = await openai.responses.create({
    model,
    instructions: `
Você é um assistente responsável por manter atualizado um arquivo Markdown chamado project-context.md.

Sua tarefa:
Receber o contexto atual do projeto e uma instrução do usuário.
Depois, devolver o arquivo Markdown completo atualizado.

Regras obrigatórias:
- Responda somente com Markdown.
- Não use bloco de código.
- Não invente decisões finais que o usuário não confirmou.
- Se algo ainda não foi decidido, marque como "Ainda não definido" ou "Em avaliação".
- Preserve informações úteis já existentes.
- Organize melhor o documento se necessário.
- Adicione novas ideias em "Ideias consideradas".
- Adicione escolhas confirmadas em "Decisões tomadas".
- Atualize "Dúvidas em aberto" e "Próximos passos".
- Mantenha o documento limpo, simples e útil para orientar o Tutor.
`,
    input: `
CONTEXTO ATUAL:

${currentContext}

INSTRUÇÃO DO USUÁRIO:

${userInstruction}
`
  });

  const updatedMarkdown = response.output_text?.trim();

  if (!updatedMarkdown) {
    throw new Error("A IA não retornou um Markdown válido.");
  }

  writeProjectContext(updatedMarkdown);

  return updatedMarkdown;
}

async function suggestProjectIdeas(area?: string | null) {
  const currentContext = readProjectContext();

  const response = await openai.responses.create({
    model,
    instructions: `
Você é um mentor técnico ajudando dois amigos a escolherem um projeto de programação.

Objetivo:
Sugerir ideias realistas, úteis e possíveis de desenvolver em MVP.

Regras:
- Responda em português do Brasil.
- Seja prático.
- Considere o contexto atual do projeto.
- Sugira ideias que ajudem no aprendizado.
- Evite ideias grandes demais para começar.
- Para cada ideia, mostre:
  1. Nome da ideia
  2. Problema que resolve
  3. MVP
  4. Stack sugerida
  5. Dificuldade
  6. Por que vale a pena
`,
    input: `
CONTEXTO ATUAL DO PROJETO:

${currentContext}

ÁREA DE INTERESSE INFORMADA:

${area || "Nenhuma área específica informada."}
`
  });

  return response.output_text || "Não consegui gerar sugestões agora.";
}

client.once(Events.ClientReady, (readyClient) => {
  ensureContextFileExists();
  console.log(`Bot online como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "tutor") {
    const question = interaction.options.getString("pergunta", true);

    await interaction.deferReply();

    try {
      const projectContext = readProjectContext();

      const response = await openai.responses.create({
        model,
        instructions: `
${tutorInstructions}

Contexto atual do projeto:

${projectContext}
`,
        input: question
      });

      const answer = response.output_text?.trim();

      if (!answer) {
        throw new Error("A IA não retornou uma resposta válida.");
      }

      await replyLongText(interaction, answer);
    } catch (error) {
      console.error("Erro ao chamar a OpenAI:", error);

      await interaction.editReply(
        "Deu erro ao consultar o Tutor. Verifique o terminal, a chave da OpenAI e o modelo configurado no .env."
      );
    }

    return;
  }

  if (interaction.commandName === "contexto") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "ver") {
  const context = readProjectContext();

  await replyWithMarkdownFile(
    interaction,
    context,
    "project-context.md",
    "Aqui está o contexto atual do projeto em Markdown:",
    { ephemeral: true }
  );

  return;
}

    if (subcommand === "atualizar") {
      const instruction = interaction.options.getString("instrucao", true);

      await interaction.deferReply();

      try {
        const updatedContext = await updateContextWithAI(instruction);

        await interaction.editReply(
          "Contexto atualizado com sucesso. Use `/contexto ver` para revisar."
        );

        console.log("\nContexto atualizado:\n");
        console.log(updatedContext);
      } catch (error) {
        console.error("Erro ao atualizar contexto:", error);

        await interaction.editReply(
          "Não consegui atualizar o contexto. Verifique o terminal para mais detalhes."
        );
      }

      return;
    }

    if (subcommand === "sugerir") {
      const area = interaction.options.getString("area");

      await interaction.deferReply();

      try {
        const suggestions = await suggestProjectIdeas(area);
        await replyLongText(interaction, suggestions);
        
      } catch (error) {
        console.error("Erro ao sugerir ideias:", error);

        await interaction.editReply(
          "Não consegui sugerir ideias agora. Verifique o terminal."
        );
      }

      return;
    }
  }
});

client.login(discordToken);
