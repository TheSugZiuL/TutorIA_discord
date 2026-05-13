# Monitoramento seguro com Cloudflare Workers

Este monitor usa um modelo push-only:

- A VM envia status por HTTPS para um Cloudflare Worker.
- A Cloudflare guarda apenas o ultimo status em Workers KV.
- O navegador acessa uma tela autenticada por senha.
- Nenhuma porta da VM precisa ficar aberta para o painel.

## 1. O que sera publicado

O painel fica em:

```text
monitor-dashboard
```

Ele contem:

- arquivos estaticos: `index.html`, `app.js`, `styles.css`
- API runtime: `src/index.js`
- configuracao Worker: `wrangler.jsonc`
- build sem framework: `npm run build`, gerando `dist`

## 2. Criar Workers KV

Na Cloudflare:

1. Abra **Workers & Pages**.
2. Va em **KV**.
3. Crie um namespace, por exemplo:

```text
tutor-monitor-status
```

Depois, no Worker, adicione o binding:

```text
Variable name: MONITOR_STATUS_KV
KV namespace: tutor-monitor-status
```

Crie o binding para **Production** e, se for usar previews, tambem para **Preview**.

## 3. Gerar secrets

No PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
-join ($bytes | ForEach-Object { $_.ToString("x2") })
```

Gere dois valores diferentes:

- `MONITOR_AGENT_TOKEN`: token usado pela VM para enviar status.
- `MONITOR_SESSION_SECRET`: segredo usado para assinar o cookie de sessao.

Defina tambem uma senha forte para:

```env
MONITOR_DASHBOARD_PASSWORD=
```

## 4. Deploy pelo GitHub

No GitHub, confirme que o repositorio tem a pasta `monitor-dashboard` e o arquivo `wrangler.jsonc` na raiz.

Na Cloudflare:

1. Abra **Workers & Pages**.
2. Selecione **Create application**.
3. Use **Import a repository**.
4. Conecte o repositorio do GitHub.
5. Configure o Worker:

```text
Project name: tutor-monitor-status
Production branch: main
Root directory: deixe vazio ou use a raiz do repositorio
Build command: npm run build:monitor
Deploy command: npx wrangler deploy
```

O arquivo `wrangler.jsonc` da raiz informa para a Cloudflare que existe um Worker real em `monitor-dashboard/src/index.js` e que os assets ficam em `monitor-dashboard/dist`.

Em **Settings > Variables and Secrets**, configure os runtime secrets/variables:

```env
MONITOR_AGENT_TOKEN=
MONITOR_DASHBOARD_PASSWORD=
MONITOR_SESSION_SECRET=
MONITOR_STATUS_TTL_SECONDS=86400
```

Marque os tres primeiros como secrets.

Em **Settings > Bindings**, configure:

```text
MONITOR_STATUS_KV
```

Depois faca um novo deploy se os bindings/secrets foram adicionados depois do primeiro deploy.

## 5. Dominio

No Worker:

1. Va em **Custom domains**.
2. Selecione **Set up a domain**.
3. Use um subdominio, por exemplo:

```text
monitor.seudominio.com
```

Se o DNS do dominio ja esta na Cloudflare, o CNAME costuma ser criado automaticamente. Se precisar criar manualmente:

```text
Type: CNAME
Name: monitor
Target: tutor-monitor.<sua-conta>.workers.dev
Proxy: enabled
```

## 6. Instalar o agente na VM

O agente ja foi copiado para a VM durante a preparacao. Se precisar copiar novamente:

```powershell
scp -i "$HOME\.ssh\ssh-key-2026-05-12 (1).key" -r .\monitor-agent ubuntu@163.176.197.11:/home/ubuntu/discord-tutor-bot/
```

Na VM:

```bash
cd ~/discord-tutor-bot
sudo install -m 644 monitor-agent/tutor-monitor-agent.service /etc/systemd/system/tutor-monitor-agent.service
sudo install -m 644 monitor-agent/tutor-monitor-agent.timer /etc/systemd/system/tutor-monitor-agent.timer
sudo chmod 755 monitor-agent/monitor-agent.py
sudo cp monitor-agent/tutor-monitor-agent.env.example /etc/tutor-monitor-agent.env
sudo chmod 600 /etc/tutor-monitor-agent.env
sudo nano /etc/tutor-monitor-agent.env
```

Preencha:

```env
MONITOR_ENDPOINT=https://monitor.seudominio.com/api/ingest
MONITOR_AGENT_TOKEN=mesmo-token-configurado-na-cloudflare
PROJECT_DIR=/home/ubuntu/discord-tutor-bot
BOT_CONTAINER_NAME=tutor-dev-bot
BOT_SERVICE_NAME=tutor-dev-bot
LOG_TAIL_LINES=20
DISK_PATH=/
```

Ative:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tutor-monitor-agent.timer
sudo systemctl start tutor-monitor-agent.service
```

Verifique:

```bash
sudo systemctl list-timers tutor-monitor-agent.timer
sudo journalctl -u tutor-monitor-agent.service -n 50 --no-pager
```

Depois disso, voce pode remover a regra de entrada SSH na Oracle. O agente so precisa de saida HTTPS.

## 7. Operacao

Abrir painel:

```text
https://monitor.seudominio.com
```

O painel mostra:

- estado do container `tutor-dev-bot`
- memoria, disco e uptime da VM
- containers Docker
- logs recentes sanitizados

O status fica marcado como desatualizado se a Cloudflare nao receber dados por mais de 3 minutos.

## 8. Seguranca

- Nao exponha o Dozzle publicamente.
- Nao abra portas para o painel na VM.
- Nao coloque tokens em prints, commits ou mensagens.
- Se `MONITOR_AGENT_TOKEN` vazar, gere outro e atualize a Cloudflare e `/etc/tutor-monitor-agent.env`.
- Se a senha do painel vazar, altere `MONITOR_DASHBOARD_PASSWORD` na Cloudflare e redeploye.

## 9. Troubleshooting

Se a Cloudflare mostrar:

```text
Variables cannot be added to a Worker that only has static assets.
```

O projeto foi detectado como assets estaticos sem Worker runtime. Confirme estes pontos:

- O **Root directory** esta vazio ou apontando para a raiz do repositorio.
- O arquivo `wrangler.jsonc` existe no commit usado pelo deploy.
- O `wrangler.jsonc` tem `main: "./monitor-dashboard/src/index.js"`.
- O deploy command esta como `npx wrangler deploy`.
- O build command esta como `npm run build:monitor`.

Depois salve as configuracoes e rode um novo deploy. Com `main` definido, a Cloudflare passa a criar um Worker real e libera secrets, variables e bindings.
