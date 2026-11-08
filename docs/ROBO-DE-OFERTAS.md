# Robô de ofertas

Descobre ofertas em fontes públicas, guarda histórico de preços, calcula nota e desconto validado, e entrega tudo para a seção "Ofertas" de `/explorar`.

## O que funciona

| Fonte      | Páginas lidas                                                                                       | Observação                                                            |
| ---------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Promobit   | home, `/promocoes/loja/<amazon\|mercado-livre\|shopee\|aliexpress>/`                                | Só a primeira página de cada listagem. Só ofertas com preço `NORMAL`. |
| Pechinchou | home e subcategorias das categorias configuradas (`PECHINCHOU_CATEGORIES` em `src/robot/config.ts`) | Lê o sitemap de categorias.                                           |

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

**Mercado Livre e Shopee só com o seu link:** as ofertas do robô dessas lojas só aparecem no site depois que você cadastra o seu link de afiliado nelas (o link delas é gerado pelo painel de cada programa e não dá para montar). Os produtos da sua vitrine (`/perfil` > "Produtos da vitrine" > aba da loja) sempre aparecem. No painel de links, todas as ofertas continuam listadas para você cadastrar. A lista de lojas com essa regra é `STORES_REQUIRING_LINK` em `src/robot/queries.ts`.

**Amazon automática:** informe o seu código de associado (ex.: `seusite-20`) em `/perfil` (ou `/admin`) > "Código de associado da Amazon". Toda oferta da Amazon com a página do produto (`/dp/ASIN`) e sem link cadastrado ganha `https://www.amazon.com.br/dp/ASIN?tag=seu-codigo`. É só o formato simples `?tag=`: não copia `linkId`, `linkCode` nem outros parâmetros de rastreio. Um link cadastrado por produto sempre tem prioridade, e apagar o código desliga o automático. Vale para a Amazon apenas; Mercado Livre, Shopee e AliExpress seguem só com link cadastrado. Confira os termos do Amazon Associates e mantenha a divulgação de afiliado visível.

`buy_url` da API é, nesta ordem: seu link cadastrado → URL limpa do produto (Amazon `/dp/<ASIN>` ou página de produto do Mercado Livre, sem query) → `null`. Com `null`, o site não mostra botão de compra.

## Variáveis de ambiente

| Variável             | Para quê                                                              |
| -------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`       | Postgres (já usada pelo projeto)                                      |
| `ROBOT_CONTACT`      | URL ou e-mail de contato no User-Agent. **Obrigatória** para coletar. |
| `ROBOT_INTERVAL_MIN` | Intervalo do `robot:loop` (padrão 30, mínimo 10)                      |

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

## Produtos da vitrine: cadastro rápido

Em `/perfil` > "Produtos da vitrine", cada produto vira um card na aba da loja, com o seu link no botão de compra. A Shopee não tem botão para abrir a vitrine: a aba mostra só os produtos cadastrados. Para cadastrar mais rápido:

- **Favorito:** arraste o botão "Copiar produto (Mimá)" para a barra de favoritos. Na página de um produto (Mercado Livre, Shopee ou Amazon), clique no favorito: ele lê título, imagem e preço que a página já mostra e copia. Cole no campo "Colar dados do produto" para preencher o formulário e cole o seu link de afiliado. Roda no seu navegador; o servidor não lê a página da loja (o Mercado Livre bloqueia leitura automática com verificação anti-bot). Alguns sites podem bloquear favoritos ou mudar a página, então confira título e preço.
- **Planilha:** "Baixar planilha" / "Importar planilha" (`id;loja;titulo;preco;preco_anterior;url_da_imagem;seu_link_de_afiliado`). Linha sem `id` cria um produto; com `id` atualiza.
- O preço dos produtos da vitrine é o que você informa e envelhece: o card mostra a data de atualização e o aviso de que o preço pode mudar.
- Lojas não embutíveis (Amazon, Mercado Livre) com link de vitrine configurado mostram um cartão "Ver vitrine" que abre o link em nova aba. A Shopee não mostra esse cartão.

## Shopee pela API oficial de afiliados

Em `/perfil` > "Produtos da vitrine" > "Importar da Shopee": cole o link de um produto (página do produto ou link curto) e o sistema consulta a API de afiliados da Shopee e preenche título, preço, imagem e o link de afiliado que a **própria Shopee** gera para a sua conta. Você confere e clica em "Adicionar à vitrine". O botão "Atualizar preços da Shopee" reconsulta a API e atualiza o preço (e a data) dos produtos que foram importados assim.

Precisa de aprovação no programa de afiliados da Shopee e das variáveis `SHOPEE_APP_ID` e `SHOPEE_APP_SECRET` (no `.env` e no Railway; nunca em conversas). `SHOPEE_API_URL` é opcional (padrão `https://open-api.affiliate.shopee.com.br/graphql`).

**Atenção:** foi escrita a partir de fontes de terceiros, sem a documentação oficial e sem credenciais; o formato da assinatura e os nomes dos campos precisam ser confirmados com um teste real. Os testes automáticos usam uma API simulada. Se a API recusar algo, a mensagem dela aparece no painel.
