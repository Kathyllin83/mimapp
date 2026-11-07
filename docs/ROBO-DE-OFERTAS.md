# Robô de ofertas

Descobre ofertas em fontes públicas, guarda histórico de preços, calcula nota e desconto validado, e entrega tudo para a seção "Ofertas" de `/explorar`.

## O que funciona

| Fonte | Páginas lidas | Observação |
| --- | --- | --- |
| Promobit | home, `/promocoes/loja/<amazon\|mercado-livre\|shopee\|aliexpress>/` | Só a primeira página de cada listagem. Só ofertas com preço `NORMAL`. |
| Pechinchou | home e subcategorias das categorias configuradas (`PECHINCHOU_CATEGORIES` em `src/robot/config.ts`) | Lê o sitemap de categorias. |

Ambas leem o JSON de `<script id="__NEXT_DATA__">`. Só as 4 lojas (Amazon, Mercado Livre, Shopee, AliExpress) são mantidas.

## O que não funciona (não implementado de propósito)

Mercado Livre direto (anti-bot), Amazon direto (termos de uso), AliExpress e Shopee direto (robots.txt bloqueia), Pelando (renderizado por JS), Cuponomia (403).

## Regras de conformidade

- Lê e obedece o `robots.txt`. Se não conseguir ler (exceto 404), **não coleta**.
- User-Agent fixo e honesto: `MimaBot/1.0 (+<ROBOT_CONTACT>)`. Sem rotação, proxy ou disfarce.
- Mínimo de 5 s entre requisições ao mesmo host, sem paralelismo por host.
- 401/403/429 ou CAPTCHA: a fonte vira **bloqueada**, a coleta para e só tenta de novo após 24 h.
- Não usa APIs internas (`/api/*`).
- Nunca grava tag de afiliado de terceiros, nem resolve o redirecionador do Promobit.

## Desconto e nota

- Desconto **validado** só com histórico próprio: ≥ 5 dias distintos dentro de ≥ 14 dias; compara com a **mediana**. Sem isso, o site mostra "de R$ X por R$ Y, preço informado pela loja".
- **Possível falsa promoção**: histórico validado com mediana até 5 % acima do preço atual, mas a fonte alega desconto. O peso do desconto zera.
- Nota 0–100, pesos em `DEFAULT_WEIGHTS` (`src/robot/config.ts`): desconto 40, proximidade do menor preço 20, popularidade 15, confiabilidade do histórico 15, disponibilidade 10. Desconto não validado vale 40 % do componente. Oferta indisponível tem teto 20.
- Ponto de preço só é gravado se o preço mudou ou passaram 6 h.
- Ofertas fechadas na fonte, ou não vistas há mais de 48 h, somem do site.

## Como usar

```bash
docker compose up -d                 # Postgres
npm run db:migrate                   # cria as tabelas robot_*
npm run robot:run                    # uma varredura (~3 min por fonte)
npm run robot:run -- --source=promobit
npm run robot:loop                   # repete a cada ROBOT_INTERVAL_MIN (padrão 30, mínimo 10)
npm run dev                          # site em http://localhost:5173/explorar
```

Rode o robô no **seu computador**. IPs de servidores e nuvem costumam ser bloqueados por essas fontes; nesse caso o robô apenas marca "bloqueada". Se a coleta parar, o site continua mostrando o último dado e informa a data da última atualização.

### Seu link de afiliado

Você gera o link no painel de cada programa de afiliados; o sistema só **cadastra e valida o domínio** (não altera o link, não garante comissão). Três jeitos:

1. **Painel `/admin` > Afiliados** (entre como administrador): lista as ofertas sem link, filtra por loja, abre o produto na loja (quando há URL limpa) e salva o seu link ao lado de cada uma.
2. **Planilha:** `npm run robot:affiliate-export` gera `ofertas-afiliados.csv` (use `-- --all` para todas); preencha a coluna `seu_link_de_afiliado` e rode `npm run robot:affiliate-import -- ofertas-afiliados.csv`. Também dá para baixar e importar a planilha pelo painel. Aceita `;` (Excel em português) ou `,`; linhas sem link são ignoradas.
3. **Uma oferta só:** `npm run robot:affiliate -- <id-da-oferta> <seu-link>`.

Só aceita https nos domínios `amazon.com.br`/`amzn.to`, `mercadolivre.com.br`/`meli.la`, `shopee.com.br`/`shope.ee`, `aliexpress.com`/`s.click.aliexpress.com`, e da mesma loja da oferta. O link vale para o produto em qualquer fonte (chave: título normalizado + loja).

`buy_url` da API é, nesta ordem: seu link cadastrado → URL limpa do produto (Amazon `/dp/<ASIN>` ou página de produto do Mercado Livre, sem query) → `null`. Com `null`, o site não mostra botão de compra.

## Variáveis de ambiente

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | Postgres (já usada pelo projeto) |
| `ROBOT_CONTACT` | URL ou e-mail de contato no User-Agent. **Obrigatória** para coletar. |
| `ROBOT_INTERVAL_MIN` | Intervalo do `robot:loop` (padrão 30, mínimo 10) |

## API (somente leitura)

- `GET /api/offers`: filtros `topic`, `marketplace`, `category`, `q`, `min_score`, `sort` (`score`\|`price`\|`recent`), `validated_only=1`, `with_affiliate_link=1`, `per_page` (máx. 100), `page`.
- `GET /api/offers/topics`: `[{slug, label}]`.

Não expõe a URL da fonte. Ofertas iguais entre fontes (título normalizado + loja) aparecem uma vez.

## Estrutura

`src/robot/`: `robots.ts`, `http.ts` (cliente educado), `connectors/`, `normalize.ts`, `pricing.ts`, `topics.ts`, `store.ts` (Postgres), `runner.ts` (lock, saúde por fonte, backoff), `queries.ts` (leitura).

Saúde por fonte (`robot_source_health`): `operating`, `failing`, `blocked`, `structure_changed`, `disabled`, com data da última coleta bem-sucedida e motivo. Para reativar uma fonte bloqueada depois de resolver o problema: `UPDATE robot_source_health SET status='operating', next_attempt_at=NULL WHERE source='promobit';`

## Limites conhecidos

- Os caminhos do JSON foram verificados em 7/11/2026; se o HTML mudar, a fonte vira `structure_changed` e a coleta para.
- Só a primeira página de cada listagem (~12 a 25 ofertas).
- O link final da loja do Promobit passa por redirecionador de afiliado deles e não é usado: sem seu link cadastrado, essas ofertas ficam sem botão de compra.
- Os dados e as imagens são de terceiros; leia os termos de uso das fontes antes de deixar o robô rodando o tempo todo.

## Abas por loja e vitrines

Em `/explorar`, a seção "Ofertas" tem abas: Todas as lojas, Amazon, Mercado Livre, Shopee e AliExpress.

**Vitrine pública** (só nas abas Amazon, Mercado Livre e Shopee): configure em `/admin` > Afiliados > "Vitrines por loja". Para cada loja, informe o link https da vitrine, um título (opcional) e a altura do quadro (300 a 3000 px, padrão 900). Ela aparece acima das ofertas do robô, sem editar código nem reiniciar nada. Ficam em `robot_vitrines` (migration `004`). A página da vitrine precisa permitir ser exibida dentro de outro site (`X-Frame-Options` / `frame-ancestors`).

`GET /api/vitrines` é público; alterar ou remover exige conta de administrador.
