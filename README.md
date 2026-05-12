# Tutor Dev Bot

Bot privado/local para Discord que funciona como copiloto de projeto para dois desenvolvedores. Ele usa Discord.js, TypeScript e a Responses API da OpenAI para ajudar com dúvidas técnicas, contexto do projeto, ideias, decisões, tarefas, erros, revisão de código e commits.

## Requisitos

- Node.js 20+
- npm
- Um app/bot criado no Discord Developer Portal
- Uma chave da OpenAI

## Instalação

```bash
npm install
```

Crie um `.env` baseado em `.env.example`:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
OPENAI_API_KEY=
OPENAI_MODEL=
AUTHORIZED_USER_IDS=
```

`AUTHORIZED_USER_IDS` é opcional. Se ficar vazio, todos podem usar comandos que alteram arquivos. Se tiver IDs separados por vírgula, só esses usuários podem usar comandos sensíveis.

## Rodando localmente

Registre os comandos no servidor configurado:

```bash
npm run register
```

Inicie o bot:

```bash
npm run dev
```

Diagnóstico opcional do token e servidor:

```bash
npm run diagnose
```

## Comandos

- `/tutor pergunta`
- `/contexto ver`
- `/contexto atualizar instrucao`
- `/contexto sugerir area`
- `/ideias area objetivo`
- `/decidir comparar ideia_a ideia_b criterio`
- `/decidir salvar decisao motivo`
- `/tarefas gerar objetivo`
- `/tarefas ver`
- `/tarefas adicionar tarefa`
- `/tarefas concluir id`
- `/erro analisar mensagem contexto`
- `/erro salvar titulo solucao observacoes`
- `/revisar codigo linguagem objetivo`
- `/commit alteracoes idioma`

## Storage local

Os dados ficam em Markdown dentro de `src/storage/`:

- `project-context.md`
- `decisions.md`
- `tasks.md`
- `errors.md`
- `learning-progress.md`

Os arquivos são criados automaticamente se não existirem. Alterações importantes geram backup em `context-backups/`.

## Build e preparo para deploy futuro

```bash
npm run build
npm start
```

Também há um `Dockerfile` simples com Node 20. Ele faz `npm ci`, compila TypeScript e inicia com `npm start`. Não faça commit do `.env` nem exponha tokens em logs, prints ou mensagens do Discord.
