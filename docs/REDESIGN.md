# MIMÁ — direção visual e dados

## Direção visual

A aplicação usa TanStack Start, React, TypeScript, Tailwind, Radix UI, Lucide e Sonner. A landing pública continua em `/`; o aplicativo começa em `/explorar`.

A direção usa bordô `#701C3D`, vinho `#4D1029`, rosa suave `#F8EDF1`, branco frio `#FAFAFC` e texto `#251B22`, com Fraunces nos títulos e Plus Jakarta Sans na interface. As fotografias existentes e a composição editorial dão personalidade às telas. A navegação mobile tem safe areas, estados ativos e áreas de toque generosas. As transições respeitam `prefers-reduced-motion`.

`BrandObject` é uma sacola ilustrada em CSS, sem engine 3D. A imagem pode ser substituída por um asset futuro.

## Dados e estados vazios

Os produtos, ofertas, dupes e alertas de exemplo foram removidos do código de apresentação. A antiga coleção de fixtures foi excluída; `src/lib/catalog.ts` contém apenas as categorias de navegação.

Explorar, Desejos, Alertas, Comparar, Dupes, Assistente, Planos e as áreas administrativas sem fonte de dados apresentam estados vazios. A assistente e os adaptadores de marketplace não retornam recomendações nem preços inventados. O painel administrativo mostra somente a taxonomia estática e o estado de conexão dos serviços.

O store começa sem produtos favoritos, desejos ou alertas. Ao carregar o estado salvo, ele ignora os IDs e nomes conhecidos dos itens de exemplo anteriores e preserva os demais desejos da pessoa usuária. Os dados de desejos existentes no backend também são preservados, exceto pelos três registros de exemplo reconhecidos pelos nomes.

As listas podem receber desejos informados pela pessoa usuária. Planos, cotas e serviços pagos ainda não estão conectados e não são apresentados como ativos.

## Verificação

O build de cliente e servidor foi executado. TypeScript concluiu sem erros. Lint sem erros e com sete avisos de Fast Refresh nos componentes compartilhados/store. Não foram adicionados testes novos nesta alteração.
