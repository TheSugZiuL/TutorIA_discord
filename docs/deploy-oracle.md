# Deploy seguro na Oracle Cloud Always Free

Este bot não precisa receber tráfego HTTP. Ele só precisa sair para a internet para conectar no Discord e na OpenAI. Por isso, não abra portas 80/443 para ele.

## 1. Criar a VM

Na Oracle Cloud, crie uma instância em Compute usando:

- Imagem: Ubuntu 24.04 LTS ou Ubuntu 22.04 LTS
- Shape: `VM.Standard.A1.Flex` marcada como Always Free eligible
- Tamanho sugerido: 1 OCPU e 2 GB a 4 GB de RAM
- Boot volume: 50 GB
- Public IPv4: habilitado, para facilitar SSH

Se aparecer `out of host capacity`, tente outro availability domain ou aguarde e tente novamente.

## 2. Rede segura

No Security List ou Network Security Group da instância:

- Entrada TCP 22: permita somente o seu IP público com `/32`
- Não abra 80, 443 ou outras portas para este bot
- Saída: mantenha liberada para HTTPS, pois o bot precisa acessar Discord e OpenAI

Exemplo de origem para SSH:

```text
203.0.113.10/32
```

## 3. Acessar por SSH

No seu computador:

```bash
ssh -i sua-chave.pem ubuntu@IP_PUBLICO_DA_VM
```

Se a imagem for Oracle Linux, o usuário costuma ser `opc`. Para Ubuntu, use `ubuntu`.

## 4. Instalar Docker e Compose

Na VM Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
echo "Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc" | sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null
```

```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker
docker run hello-world
docker compose version
```

## 5. Enviar o projeto para a VM

Opção com Git:

```bash
git clone URL_DO_REPOSITORIO discord-tutor-bot
cd discord-tutor-bot
```

Opção com `scp`, a partir do seu computador:

```bash
scp -i sua-chave.pem -r ./discord-tutor-bot ubuntu@IP_PUBLICO_DA_VM:/home/ubuntu/discord-tutor-bot
```

Não envie `.env` para repositórios. Crie o `.env` diretamente na VM.

Evite compartilhar saída de comandos como `docker compose config`, porque eles podem expandir e mostrar valores do `.env`.

## 6. Configurar secrets

Na VM, dentro da pasta do projeto:

```bash
nano .env
chmod 600 .env
```

Preencha:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
OPENAI_API_KEY=
OPENAI_MODEL=
AUTHORIZED_USER_IDS=
SQLITE_DATABASE_PATH=data/tutor-dev-bot.sqlite
```

Use `AUTHORIZED_USER_IDS` para limitar comandos que alteram arquivos:

```env
AUTHORIZED_USER_IDS=123456789012345678,987654321098765432
```

## 7. Subir o bot

```bash
mkdir -p data src/storage context-backups
sudo chown -R 1000:1000 data src/storage context-backups
docker compose build
docker compose run --rm tutor-dev-bot node dist/diagnose-database.js
docker compose run --rm tutor-dev-bot node dist/register-commands.js
docker compose up -d
docker compose logs -f --tail=100 tutor-dev-bot
```

Para sair dos logs sem parar o bot, pressione `Ctrl+C`.

## 8. Operação diária

Ver status:

```bash
docker compose ps
```

Ver logs:

```bash
docker compose logs -f --tail=100 tutor-dev-bot
```

Reiniciar:

```bash
docker compose restart tutor-dev-bot
```

Parar:

```bash
docker compose down
```

Atualizar depois de `git pull`:

```bash
git pull
docker compose build --pull
docker compose run --rm tutor-dev-bot node dist/diagnose-database.js
docker compose run --rm tutor-dev-bot node dist/register-commands.js
docker compose up -d
```

## 9. Backup dos dados

Os dados persistentes ficam em:

- `data/tutor-dev-bot.sqlite`
- `data/tutor-dev-bot.sqlite-wal`
- `data/tutor-dev-bot.sqlite-shm`
- `src/storage`
- `context-backups`

Backup simples:

```bash
tar -czf tutor-storage-backup-$(date +%F).tar.gz data src/storage context-backups
```

Guarde o `.env` separadamente em local seguro. Não coloque tokens dentro do arquivo de backup compartilhado.

## 10. Observações de segurança

- Não abra porta pública para o bot; ele não é servidor web.
- Restrinja SSH ao seu IP no painel da Oracle.
- Não use token do Discord ou OpenAI em comandos públicos.
- Se algum token aparecer em commit, print ou log compartilhado, revogue e gere outro.
- O container roda como usuário não-root, sem capabilities Linux extras e com filesystem read-only, exceto os volumes de dados, storage e backups.
