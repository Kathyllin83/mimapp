# Mimá

Aplicação de promoções, comparação de preços e descoberta de dupes de beleza.

## Development

Você pode executar o projeto localmente com Node.js/npm ou Bun.

```sh
git clone <this-repository-url>
cd mimapp
npm install
npm run dev
```

## PostgreSQL

Com PostgreSQL local instalado e em execução:

```sh
npm install
npm run db:migrate
npm run db:seed-admin
npm run dev
```

O usuário administrativo inicial é `root@mima.local` com a senha `Mima123!`.
Para outro ambiente, copie `.env.example` para `.env` e configure `DATABASE_URL`.
