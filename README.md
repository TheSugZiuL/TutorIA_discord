# Tutor Dev Bot

Bot privado/local para Discord que funciona como copiloto de projeto para dois desenvolvedores. Ele usa Discord.js, TypeScript, SQLite local e a Responses API da OpenAI para ajudar com dúvidas técnicas, contexto do projeto, ideias, decisões, tarefas, erros, revisão de código e commits.

## Requisitos

- Node.js 22.16+ para rodar localmente, por causa do `node:sqlite`
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
SQLITE_DATABASE_PATH=data/tutor-dev-bot.sqlite
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

Diagnóstico do SQLite:

```bash
npm run db:status
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

O SQLite é a fonte persistente principal. Por padrão, o banco fica em:

- `data/tutor-dev-bot.sqlite`

Os arquivos Markdown continuam existindo como espelho legível em `src/storage/`:

- `project-context.md`
- `decisions.md`
- `tasks.md`
- `errors.md`
- `learning-progress.md`

Os arquivos e o banco são criados automaticamente se não existirem. Alterações importantes geram backup em `context-backups/` e também na tabela `document_backups`.

## Build e preparo para deploy

```bash
npm run build
npm start
```

Também há `Dockerfile` e `docker-compose.yml` para rodar em uma VM. Para Oracle Cloud Always Free, veja [docs/deploy-oracle.md](docs/deploy-oracle.md).

Para um painel de monitoramento externo, somente leitura e sem abrir portas na VM, veja [docs/monitoring-cloudflare.md](docs/monitoring-cloudflare.md).

Não faça commit do `.env` nem exponha tokens em logs, prints ou mensagens do Discord.
