import OpenAI from "openai";
import { getOpenAIEnv } from "../config/env.js";
import { stripMarkdownCodeFence } from "../utils/markdown.util.js";

let openaiClient: OpenAI | null = null;
let openaiClientApiKey: string | null = null;

function getClient(): OpenAI {
  const { apiKey } = getOpenAIEnv();

  if (!openaiClient || openaiClientApiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey });
    openaiClientApiKey = apiKey;
  }

  return openaiClient;
}

async function generateText(options: {
  instructions: string;
  input: string;
}): Promise<string> {
  const { model } = getOpenAIEnv();

  const response = await getClient().responses.create({
    model,
    instructions: options.instructions,
    input: options.input
  });

  const output = response.output_text?.trim();

  if (!output) {
    throw new Error("A OpenAI não retornou uma resposta de texto válida.");
  }

  return output;
}

const baseMentorRules = `
Você é um mentor técnico dentro de um servidor privado do Discord.
Responda em português do Brasil.
Seja direto, didático e prático.
Evite overengineering e prefira MVPs pequenos.
Não use @everyone, @here nem menções a usuários.
Quando faltar informação, diga exatamente qual informação precisa.
`;

export async function askTutor(
  question: string,
  organizedProjectContext: string
): Promise<string> {
  return generateText({
    instructions: `${baseMentorRules}

Formato preferencial:
Diagnóstico:
Solução:
Exemplo:
Próximo passo:
`,
    input: `CONTEXTO ORGANIZADO DO PROJETO:

${organizedProjectContext}

PERGUNTA DO USUÁRIO:

${question}`
  });
}

export async function updateProjectContextWithAI(
  currentProjectContext: string,
  userInstruction: string
): Promise<string> {
  const markdown = await generateText({
    instructions: `
Você é responsável por manter atualizado um arquivo Markdown chamado project-context.md.

Regras obrigatórias:
- Responda somente com Markdown.
- Não use bloco de código.
- Não invente decisões finais que o usuário não confirmou.
- Se algo ainda não foi decidido, marque como "Ainda não definido" ou "Em avaliação".
- Preserve informações úteis já existentes.
- Organize melhor o documento se necessário.
- Adicione novas ideias em "Ideias consideradas".
- Adicione escolhas confirmadas em uma seção de decisões ou status.
- Atualize dúvidas em aberto e próximos passos quando fizer sentido.
- Mantenha o documento limpo, simples e útil para orientar o Tutor.
`,
    input: `CONTEXTO ATUAL:

${currentProjectContext}

INSTRUÇÃO DO USUÁRIO:

${userInstruction}`
  });

  return stripMarkdownCodeFence(markdown);
}

export async function suggestContextIdeas(
  organizedProjectContext: string,
  area?: string | null
): Promise<string> {
  return generateText({
    instructions: `${baseMentorRules}
Sugira ideias de projeto com base no contexto atual.
Para cada ideia, mostre:
- nome
- problema que resolve
- MVP
- stack sugerida
- dificuldade
- por que vale a pena
`,
    input: `CONTEXTO ORGANIZADO DO PROJETO:

${organizedProjectContext}

ÁREA DE INTERESSE:
${area || "Nenhuma área específica informada."}`
  });
}

export async function generateProjectIdeas(options: {
  organizedProjectContext: string;
  area?: string | null;
  objetivo?: string | null;
}): Promise<string> {
  return generateText({
    instructions: `${baseMentorRules}
Gere exatamente 5 ideias realistas para dois amigos desenvolverem.
Evite ideias grandes demais.

Cada ideia deve conter:
- problema real que resolve
- MVP
- stack recomendada
- dificuldade de 1 a 5
- tempo estimado em semanas
- principais aprendizados
- potencial para virar portfólio
`,
    input: `CONTEXTO ORGANIZADO DO PROJETO:

${options.organizedProjectContext}

ÁREA:
${options.area || "Não informada."}

OBJETIVO:
${options.objetivo || "Não informado."}`
  });
}

export async function compareIdeas(options: {
  organizedProjectContext: string;
  ideiaA: string;
  ideiaB: string;
  criterio?: string | null;
}): Promise<string> {
  return generateText({
    instructions: `${baseMentorRules}
Compare duas ideias e ajude a escolher.

A resposta deve conter:
- comparação em tabela Markdown
- critérios: valor real, dificuldade, tempo para MVP, custo, aprendizado, portfólio e risco técnico
- recomendação final
- próximo passo sugerido
`,
    input: `CONTEXTO ORGANIZADO DO PROJETO:

${options.organizedProjectContext}

IDEIA A:
${options.ideiaA}

IDEIA B:
${options.ideiaB}

CRITÉRIO EXTRA:
${options.criterio || "Nenhum critério extra informado."}`
  });
}

export async function generateTasksFromObjective(options: {
  organizedProjectContext: string;
  objective: string;
  firstTaskId: string;
}): Promise<string> {
  return generateText({
    instructions: `${baseMentorRules}
Transforme o objetivo em tarefas pequenas, executáveis e ordenadas.
Responda somente em Markdown, sem bloco de código.
Comece a numeração pelo ID informado.

Use exatamente este formato para cada tarefa:
## T001 - Título curto
- Descrição: ...
- Prioridade: alta|média|baixa
- Dificuldade: 1 a 5
- Status: pendente
- Ordem sugerida: 1

Gere entre 5 e 8 tarefas.
`,
    input: `CONTEXTO ORGANIZADO DO PROJETO:

${options.organizedProjectContext}

OBJETIVO:
${options.objective}

PRIMEIRO ID DISPONÍVEL:
${options.firstTaskId}`
  });
}

export async function analyzeError(options: {
  organizedProjectContext: string;
  message: string;
  extraContext?: string | null;
}): Promise<string> {
  return generateText({
    instructions: `${baseMentorRules}
Analise a mensagem de erro e responda no formato:

Causa provável:
Correção:
Como testar:
Como evitar:
Explicação simples:
`,
    input: `CONTEXTO ORGANIZADO DO PROJETO:

${options.organizedProjectContext}

MENSAGEM DE ERRO:
${options.message}

CONTEXTO EXTRA:
${options.extraContext || "Não informado."}`
  });
}

export async function reviewCode(options: {
  organizedProjectContext: string;
  code: string;
  language?: string | null;
  objective?: string | null;
}): Promise<string> {
  return generateText({
    instructions: `${baseMentorRules}
Revise o código colado no Discord.

A resposta deve conter:
- o que está bom
- problemas encontrados
- riscos
- melhorias simples
- versão melhorada, se fizer sentido
- explicação didática
`,
    input: `CONTEXTO ORGANIZADO DO PROJETO:

${options.organizedProjectContext}

LINGUAGEM:
${options.language || "Não informada."}

OBJETIVO DO CÓDIGO:
${options.objective || "Não informado."}

CÓDIGO:
${options.code}`
  });
}

export async function generateCommitMessage(options: {
  changes: string;
  idioma?: string | null;
}): Promise<string> {
  const usePortuguese = options.idioma?.trim().toLowerCase() === "pt";

  return generateText({
    instructions: `${baseMentorRules}
Gere uma mensagem de commit no padrão Conventional Commits.
A resposta deve conter:
- commit recomendado
- resumo das alterações
- sugestão de branch opcional

Idioma do commit: ${usePortuguese ? "português" : "inglês"}.
`,
    input: `ALTERAÇÕES:

${options.changes}`
  });
}
