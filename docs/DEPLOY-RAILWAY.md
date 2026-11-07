# Deploy no Railway

O site (TanStack Start) roda como um servidor Node gerado pelo Nitro (`.output/server/index.mjs`). O Railway constrói o projeto com o Railpack, aplica as migrations antes de cada deploy e só troca a versão quando `/api/health` responde.

A configuração está em [railway.json](../railway.json) e a versão do Node em `.node-version` (22).

## 1. Criar o projeto

1. No Railway: **New Project > Deploy from GitHub repo** e escolha este repositório (branch de produção, normalmente `main`).
2. No mesmo projeto: **New > Database > PostgreSQL**.

## 2. Variáveis do serviço web

Em **Variables** do serviço do site:

| Variável                           | Valor                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                     | `${{Postgres.DATABASE_URL}}` (referência ao banco do projeto)          |
| `NODE_ENV`                         | `production` (ativa o cookie `Secure`)                                 |
| `APP_ORIGIN`                       | `https://<seu-dominio>` (o domínio gerado pelo Railway ou o seu)       |
| `SESSION_COOKIE`                   | `mima_session` (opcional)                                              |
| `GROQ_API_KEY`                     | chave do assistente (opcional; sem ela o assistente fica indisponível) |
| `ML_CLIENT_ID`, `ML_CLIENT_SECRET` | opcionais                                                              |

Não coloque `ROBOT_CONTACT` no Railway: o robô **não roda lá** (veja abaixo).

## 3. O que acontece em cada deploy

1. `npm run build` gera `.output/`.
2. `npm run db:migrate` (pré-deploy) aplica as migrations de `db/migrations/` (as tabelas do robô, vitrines e produtos da vitrine entram aqui).
3. `node .output/server/index.mjs` sobe o servidor na porta `PORT` definida pelo Railway.
4. O Railway espera `GET /api/health` responder 200 (banco acessível) antes de liberar o tráfego.

## 4. Criar o administrador (uma vez)

O banco novo não tem usuário. Crie o admin **com uma senha sua**; a senha padrão do README é pública e o script se recusa a usá-la em produção.

No seu computador, usando a URL **pública** do Postgres (em _Postgres > Variables > `DATABASE_PUBLIC_URL`_, porque a URL interna só funciona dentro do Railway):

```bash
DATABASE_URL="<DATABASE_PUBLIC_URL>" NODE_ENV=production \
  ADMIN_EMAIL="seu@email.com" ADMIN_PASSWORD="uma-senha-longa-e-unica" \
  npm run db:seed-admin
```

Depois entre em `https://<seu-dominio>/entrar` e use `/admin` > Afiliados para cadastrar suas vitrines, produtos e links.

## 5. Ofertas do robô: rode no seu computador

O robô **não deve rodar no Railway**: as fontes costumam bloquear IPs de nuvem, e nesse caso ele só marcaria "bloqueada". Rode-o localmente apontando para o banco do Railway, para o site mostrar as ofertas:

```bash
DATABASE_URL="<DATABASE_PUBLIC_URL>" ROBOT_CONTACT="seu-contato" npm run robot:loop
```

Enquanto o robô estiver parado, o site continua mostrando o último dado e a data da última atualização.

## 6. Checklist antes de divulgar

- [ ] `APP_ORIGIN` com o domínio final e HTTPS.
- [ ] Senha do admin trocada (passo 4) e o usuário `root@mima.local` padrão não existe em produção.
- [ ] Segredos só nas variáveis do Railway (o `.env` não vai para o Git).
- [ ] `GROQ_API_KEY` configurada se quiser o assistente (a cota de IA é aplicada no servidor).
- [ ] Rodar o robô uma vez e conferir `/explorar`.

## Observações

- O gerenciador de pacotes do projeto é o **bun** (`bun.lock`). O `package-lock.json` não é versionado.
- Para testar o build de produção localmente: `npm run build && PORT=3000 NODE_ENV=production node .output/server/index.mjs`.
